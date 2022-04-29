const mongoose = require('mongoose');


const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    bitCoin : {
        type: Number,
        default: 0,
    },
    lastNotificationCode: {
        type: Number,
        default:0,
    },
    previousHoldingValue:{
        type: Number,
        default:0,
    },
    currentHoldingValue:{
        type: Number,
        default:0,
    }
});


const User = mongoose.model('User', userSchema);

module.exports = User;