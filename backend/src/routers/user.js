const express = require("express");
const router = express.Router();
require('dotenv').config();
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require("../models/user");
const auth = require("../middleware/auth");
var API_KEY = process.env.API_KEY;
var DOMAIN = process.env.DOMAIN;
var mailgun = require('mailgun-js')
    ({ apiKey: API_KEY, domain: DOMAIN });

sendMail = function (sender_email, receiver_email,
    email_subject, email_body) {

    const data = {
        "from": sender_email,
        "to": receiver_email,
        "subject": email_subject,
        "text": email_body
    };

    mailgun.messages().send(data, (error, body) => {
        if (error) console.log(error)
        else console.log(body);
    });
}

router.post("/users/signup", async (req, res) => {
    console.log(req.body);
    const user = new User(req.body);
    try {
        const token = await user.generateAuthToken()
        await user.save();
        res.status(201).send({ user, token });
        sendMail(process.env.SENDER_EMAIL, user.email, "TheCodeWorks", "Thank You for registering to us.")
    } catch (error) {
        res.status(400).send(error);
    }
});

router.post("/users/login", async (req, res) => {
    const email = req.body.email
    const password = req.body.password
    try {
        const user = await User.findByCredentials(email, password)
        const token = await user.generateAuthToken()
        res.send({ user, token })
    } catch (error) {
        res.status(404).send()
    }
})

router.post("/users/:id/generate", async (req, res) => {
    const _id = req.params.id;
    var secret = speakeasy.generateSecret();
    try {
        const user = await User.findByIdAndUpdate(_id, { tempSecret: secret.base32 });
        if (!user) {
            return res.status(404).send();
        }
        qrcode.toDataURL(secret.otpauth_url, function (err, data) {
            res.status(201).send({ data })
        })
    } catch (error) {
        res.status(400).send()
    }
})

router.post("/users/:id/verify/:token", async (req, res) => {
    const _id = req.params.id;
    const token = req.params.token;
    try {
        const user = await User.findById(_id);
        if (!user) {
            return res.status(404).send();
        }
        const verified = await speakeasy.totp.verify({
            secret: user.tempSecret,
            encoding: 'base32',
            token

        })

        if (!verified) {
            return res.status(400).send("Verification failed");
        }
        await User.findByIdAndUpdate(_id, { auth: true });
        res.status(202).send("verified")
    } catch (error) {
        res.status(400).send()
    }
})

router.post("/users/logout", auth, async (req, res) => {
    try {
        req.user.tokens = req.user.tokens.filter((token) => {
            return token.token !== req.token
        })
        await req.user.save()
        res.status(200).send("logged out")
    } catch (error) {
        res.status(500).send()
    }
})

router.get("/users/:id", async (req, res) => {
    const _id = req.params.id;
    try {
        const user = await User.findById(_id);
        if (!user) {
            return res.status(404).send();
        }
        res.status(200).send(user);
    } catch (error) {
        res.status(500).send(error);
    }
});


module.exports = router;
