const express = require('express');
const mongoose = require('mongoose');
const User = require('./schemas/users');
const cronJob = require("cron").CronJob;
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server, {
    origin:'*',
});

app.use(express.json());

//mongodb connection

(async() => {
    try{
      const db =  await mongoose.connect('mongodb://localhost/pushNotification', { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Connected to MongoDB');
    }catch(err){
        console.error({err});
    }
    
})();

//this is an api endpoint just for creating some user in the database
app.post("/", async(req, res) => {
    const user = new User({
        name: "User 3",
        bitCoin: 0,
        previousHoldingValue: 0,
        currentHoldingValue: 0,
    });
    try{
       const newUser = await user.save((err, user) => {
            if(err){
                console.error(err);
            }else{
                console.log(user);
            }
        }
       );
        res.send(newUser);    
    }catch(err){
        console.log({err});
    }
})

//socket connection

io.on("connection" , async (socket) => {
    console.log({socket});

    //creating room for each user. For now im using user name. But later we will get token from client and 
    //then we will verify that token and then we will use user id.

    const users = await User.find({});
    users.map(user => { socket.join(user.name); });
})

// api endpoint for buy and sell order fill. after a sell we will notify both user end sending notification.
//Now im not updating database but sending notification to user.

app.post("buy-and-sell-order", async(req, res) => {
    const buyerId = req.body.buyerId;
    const sellerId = req.body.sellerId;

    const buyer = await User.findById(buyerId);
    const seller = await User.findById(sellerId);
    io.to(buyer.name).emit("buy-and-sell-order", {
        message: "you bought bitcoins",
    })
    io.to(seller.name).emit("buy-and-sell-order", {
        message: "you sold bitcoins",
    })
})


//function of checking the user holding changes after every 12 hours. if we find that the change value is 5% then
//we will send notification to user. we are doing this by cron job scheduler.

const holdingChanges = async() => {
    const users = await User.find({ });
    const  validUsers = users.filter(async (user) => {
        if((((user.currentHoldingValue - user.previousHoldingValue)/user.currentHoldingValue)*100 > 5)){
            user.previousHoldingValue = user.currentHoldingValue;
            return user;
        }
    })

    validUsers.map(async(user) => {
        io.to(user.name).emit("holding-changes", {
            message: "holding value changed by 5%",
        })
    })

}

//This function is actually monitoring the bitcoin price from time 6:00 to 9:00. if it drops to 6% then we will take 
// those users into an array who have the bitqoin.
let usersTobeNotified = [];
const monitoringBitcoinPrice = async(presentBitcoinPrice,previousBitcoinPrice) =>{
    const dropRatio = ((previousBitcoinPrice-presentBitcoinPrice)/previousBitcoinPrice)*100;
    console.log({dropRatio})
    if(dropRatio > 6){
    try{
        const users = await User.find({ });
        usersTobeNotified = users.filter((user) => {
            if(user.bitCoin > 0){
               return user;
            }
        })
        console.log({usersTobeNotified});
        let status = {
            message: "success"
        }
       return status;
    }catch(err){
        console.log({err});
        }
    }
}

//This function will send the notification of droping bitcoin price to the users who have bitCoin 
// at 9:00 .

const sendNotification = async(usersTobeNotified) => {
    usersTobeNotified.map((user) => {
        io.to(user.name).emit("send-notification", {
            message: "Bitcoin price dropped by 6%",
        })
    })
}

//job object array to pass the all jobs to the cron job scheduler on their specific time. 

const jobs = [
    {
        pattern: "*/5 * * * * *",
        job: monitoringBitcoinPrice,
        title: "monitoringBitcoinPrice", //right now monitoring bitcoin price after every 5seconds
    },
    {
        pattern: "*/30 * * * * *", //sending the notification to users who have bitCoin at every 30 seconds later.
        job: sendNotification,
        message: "sendNotification",
    }

]

//this is the cron job scheduling function.

jobs.map(job => {
    if(job.title === "monitoringBitcoinPrice"){
        new cronJob(job.pattern, () => {
            job.job(7,9);
        }).start();
    }else{
        new cronJob(job.pattern, () => {
            job.job(usersTobeNotified);
        }).start();
    }
   
})

//server listening on port 3000
server.listen(3000, () => {
    console.log("server running on prot 3000");
})