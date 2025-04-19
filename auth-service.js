const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');

const userSchema = new Schema({
    userName: { type: String, unique: true },
    password: String,
    email: String,
    loginHistory: [{
        dateTime: Date,
        userAgent: String
    }]
});

let User;

module.exports.initialize = function () {
    return new Promise((resolve, reject) => {
        const connectionString = "mongodb+srv://adharshnk:njanettan@cluster0.qpfyhuk.mongodb.net/";
        let db = mongoose.createConnection(connectionString);

        db.on('error', (err) => reject(err));
        db.once('open', () => {
            User = db.model("users", userSchema);
            resolve();
        });
    });
};

module.exports.registerUser = function (userData) {
    return new Promise((resolve, reject) => {
        let newUser = new User({
            userName: userData.userName,
            email: userData.email,
            password: userData.password
        });

        newUser.save()
            .then(() => resolve())
            .catch(err => {
                if (err.code == 11000) {
                    reject("User Name already taken");
                } else {
                    reject("There was an error creating the user: " + err);
                }
            });
    });
};

module.exports.checkUser = function (userData) {
    return new Promise((resolve, reject) => {
        User.findOne({ userName: userData.userName })
            .then(user => {
                if (!user) {
                    reject("Unable to find user: " + userData.userName);
                } else {
                    bcrypt.compare(userData.password, user.password)
                        .then(match => {
                            if (match) {
                                user.loginHistory.push({
                                    dateTime: (new Date()).toString(),
                                    userAgent: userData.userAgent
                                });
                                User.updateOne(
                                    { userName: user.userName },
                                    { $set: { loginHistory: user.loginHistory } }
                                ).then(() => resolve(user))
                                .catch(err => reject("Error updating login history"));
                            } else {
                                reject("Incorrect Password for user: " + userData.userName);
                            }
                        });
                }
            })
            .catch(() => reject("Unable to find user: " + userData.userName));
    });
};
