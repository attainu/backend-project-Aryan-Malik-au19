'use strict'
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
const dotenv = require('dotenv');
const port = process.env.PORT || 5000;
dotenv.config();
const url = process.env.URL
var users = {}

io.on("connection", (socket) => {
    socket.on("new-user-joined", (username) => {
        users[socket.id] = username;
        socket.broadcast.emit('user-connected', username)
        io.emit("user-list", users)
    });

    socket.on("disconnect", () => {
        var user = users[socket.id]
        socket.broadcast.emit("user-disconnected", user);
        delete users[socket.id];
    })

    socket.on('message', async (data) => {
        let userdata = await userModel.findOne({ Username: data.user })
        socket.broadcast.emit("message", { user: data.user, msg: data.msg, time: Date.now() })
    })
});



mongoose.connect(url, {
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

app.post('/login', async (req, res) => {
    let user = await userModel.findOne({ email: req.body.email });
    if (user) {
        const validPassword = await bcrypt.compare(req.body.password, user.password);
        if (validPassword) {
            res.cookie('usersIdentified', user.email)
            res.render('profile', user)
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
    const salt = await bcrypt.genSalt(10);
    req.body["password"] = await bcrypt.hash(req.body.password, salt);
    const userdata = new userModel(req.body)
    await userdata.save()
    res.render('login', req.body)
})


app.get('/profile', (req, res) => {
    console.log(req.headers.cookie)
    if (req.headers.cookie.includes('usersIdentified') === true) {
        res.render('profile')
        return
    }
    res.redirect('/')
})




server.listen(port, () => console.log('Server Started at http://localhost:5000/'))