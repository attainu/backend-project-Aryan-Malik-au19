'use strict'
const dotenv = require('dotenv');
dotenv.config();
const fileUpload = require('express-fileupload')
const expHbs = require('express-handlebars')
const express = require('express');
const app = express();
const bcrypt = require('bcrypt');
const userModel = require('./db/user');
const http = require("http")
const mongoose = require('mongoose');
const server = http.createServer(app);
const io = require("socket.io")(server);
const port = process.env.PORT ||5000;
const mongoURl = process.env.URL
const url = require('url');
const users = {}

mongoose.connect(mongoURl, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}, async (err) => {
    if (err) {
        console.log(err)
    }
    else {
        console.log("Database Connected")
    }
}
)

io.on("connection", (socket) => {
    socket.on("new-user-joined", (username) => {
        var user_data = userModel.findOne({ Username: username })
        if (user_data) {
            userModel.updateOne({ Username: username }, { $set: { socketId: socket.id } }, (err) => {
                if (err) {
                    console.log(err)
                }
                else {
                    console.log("Successfully updated!");
                    users[username] = socket.id;
                    socket.broadcast.emit('user-connected', username)
                    io.emit("user-list", users)
                }
            });
        }
    });

    socket.on("disconnect", () => {
        var user = Object.keys(users).find(key => users[key] === socket.id);
        if (user) {
            delete users[user];
            socket.broadcast.emit('user-disconnected', user)
            io.emit("user-list", users)
        }
    })

    socket.on('message', async (data) => {
        socket.broadcast.emit("message", { user: data.user, msg: data.msg, time: Date.now() })
    })

    socket.on('private-message', async (data) => {
        var user = Object.keys(users).find(key => users[key] === data.to);
        console.log(user)
        var message = data.msg.split(' ').slice(2, data.msg.length);
        if (user) {
            io.to(data.to).emit("private-message", { user: data.user, msg: message.join(' '), time: Date.now() })
        }
    }
    )
});

app.set('view engine', 'hbs')
app.engine('hbs', expHbs({ extname: 'hbs' }))
app.use(express.static('views'));
app.use(express.static('uploads'));
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(fileUpload({}))

app.get('/', (req, res) => {
    res.render('login')
})

app.post('/', async (req, res) => {
    let user = await userModel.findOne({ email: req.body.email });
    if (user) {
        const validPassword = await bcrypt.compare(req.body.password, user.password);
        if (validPassword) {
            res.cookie('email', user.email)
            res.redirect(url.format({
                pathname: "/profile",
                query: {
                    "username": user.Username,
                    "email": user.email,
                }
            }));
            return
        }
        else {
            res.status(300).render("login", { Message: "Incorrect" });
        }
    } else {
        res.status(300).render("login", { Message: "No user found" });
    }
})

app.get('/signup', (req, res) => {
    res.render('signup')
})

app.post('/signup', async (req, res) => {
    let user = await userModel.findOne({ Username: req.body.Username });
    if (!user) {
        const salt = await bcrypt.genSalt(10);
        req.body["password"] = await bcrypt.hash(req.body.password, salt);
        const userdata = new userModel(req.body)
        await userdata.save()
        res.redirect('/');
    }
    else {
        res.status(409).render("signup", { Message: "User email already exist. Please try another one." });
    }
})


app.get('/profile', (req, res) => {
    if (req.headers.cookie) {
        if (req.headers.cookie.includes('email') == true) {
            res.render('profile', req.query)
            return
        }
        else {
            res.redirect('/')
        }
    }
    else {
        res.redirect('/')
    }
})

server.listen(port, () => console.log('Server Started at http://localhost:5000/'))