require("./utils.js");
require('dotenv').config();
mongoose = require('mongoose');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const saltRounds = 12;
const path = require('path');

const port = process.env.PORT || 3000;

const app = express();

const Joi = require("joi");

const expireTime = 24 * 60 * 60 * 1000;
const { MongoClient } = require('mongodb');
const { name } = require("ejs");
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = encodeURIComponent(process.env.MONGODB_PASSWORD);
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const mongoUrl = `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_database}?retryWrites=true&w=majority`;
console.log("MongoDB URI:", mongoUrl);
console.log("Password:", mongodb_password);
console.log("Host:", mongodb_host);
console.log("User:", mongodb_user);

const node_session_secret = process.env.NODE_SESSION_SECRET;

const client = new MongoClient(mongoUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
var { database } = include('databaseConnections');

const userCollection = database.db(mongodb_database).collection("users");

app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: true }));

var mongoStore = MongoStore.create({
    mongoUrl: mongoUrl,
    secret: mongodb_session_secret
});

app.use(session({
    secret: node_session_secret,
    store: mongoStore,
    saveUninitialized: false,
    resave: true
}));

function isValidSession(req) {
    if (req.session.authenticated) {
        return true;
    }
    return false;
}

function sessionValidation(req, res, next) {
    if (isValidSession(req)) {
        next();
    }
    else {
        res.redirect('/login');
    }
}

function isAdmin(req) {
    if (req.session.user_type == 'admin') {
        return true;
    }
    return false;
}
function adminAuthorization(req, res, next) {
    if (!req.session.authenticated) {
        return res.redirect('/login');
    }
    if (req.session.user_type !== 'admin') {
        return res.status(403).send('Access denied: You are not authorized to view this page.');
    }
    next();
}

app.get('/admin', adminAuthorization, async (req, res) => {
    try {
        await client.connect();
        const database = client.db("Assignment1");
        const users = database.collection("users");
        // Use the $ifNull operator to set a default value for user_type
        const userList = await users.find({},
            {
                projection: {
                    name: 1, email: 1,
                    user_type: { $ifNull: ["$user_type", "user"] }  // Defaulting to 'user' if user_type is not set
                }
            }).toArray();
        res.render('admin', { users: userList });
    } catch (error) {
        console.error('Failed to retrieve users:', error);
        res.status(500).send('Error fetching user data.');
    } finally {
        await client.close();
    }
});

app.get('/promote/:userId', adminAuthorization, async (req, res) => {
    console.log("Attempting to promote user with ID:", req.params.userId);
    const userId = req.params.userId;
    try {
        await client.connect();
        const database = client.db("Assignment1");
        const users = database.collection("users");
        const updateResult = await users.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { user_type: 'admin' } }
        );
        console.log("Update result:", updateResult);
        res.redirect('/admin');
    } catch (error) {
        console.error('Failed to promote user:', error);
        res.status(500).send('Error promoting user.');
    } finally {
        await client.close();
    }
});


app.get('/demote/:userId', adminAuthorization, async (req, res) => {
    const userId = req.params.userId;
    try {
        await client.connect();
        const database = client.db("Assignment1");
        const users = database.collection("users");
        await users.updateOne(
            { _id: new ObjectId(userId) },
            { $set: { user_type: 'user' } }
        );
        res.redirect('/admin');
    } catch (error) {
        console.error('Failed to demote user:', error);
        res.status(500).send('Error demoting user.');
    } finally {
        await client.close();
    }
});


app.get('/', (req, res) => {
    // Check if the user is authenticated
    if (req.session.authenticated) {
        // If the user is logged in, render a personalized home page
        res.render('loggedin', {
            name: req.session.name, // Display the name stored in the session
            links: [
                { href: '/members', text: 'Members Area' }, // Link to members area
                { href: '/logout', text: 'Logout' } // Link to logout
            ]
        });
    } else {
        // If the user is not logged in, render the home page with login and signup links
        res.render('index', {
            links: [
                { href: '/signup', text: 'Sign Up' }, // Link to sign up page
                { href: '/login', text: 'Log In' } // Link to log in page
            ]
        });
    }
});


app.get('/nosql-injection', async (req, res) => {
    var name = req.query.user;

    if (!name) {
        res.send('<h3>no user provided - try /nosql-injection?user-name</h3> <h3>or /nosql-injection?user[$ne]=name</h3>');
        return;
    }
    console.log("user: " + username);

    const schema = Joi.string().max(20).required();
    const validationResult = schema.validate(name);

    if (validationResult.error != null) {
        console.log(validationResult.error);
        res.send("<h1 style='color:darkred;'> A NoSQL injection attack was detected!! </h1>");
        return;
    }

    const result = await userCollection.find({ name: name }).project({ name: 1, password: 1, _id: 1 }).toArray();

    console.log(result);

    res.send('<h1> Hello ${name}</h1>');
});

app.get
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }
});

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Display the signup form

app.get('/signup', (req, res) => {
    res.render("signup");
});

// Display the login form
app.get('/login', (req, res) => {
    res.render("login");
});

// Handle the signup submission
app.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;

    // Validation schema using Joi
    const schema = Joi.object({
        name: Joi.string().trim().alphanum().max(20).required(),
        email: Joi.string().trim().email().required(),
        password: Joi.string().min(6).max(20).required()
    });

    // Perform the validation
    const validationResult = schema.validate({ name, email, password });
    if (validationResult.error) {
        let message = "Error: ";
        validationResult.error.details.forEach(detail => {
            switch (detail.context.key) {
                case "name":
                    message += "Please provide a valid name. ";
                    break;
                case "email":
                    message += "Please provide a valid email address. ";
                    break;
                case "password":
                    message += "Please provide a valid password. ";
                    break;
            }
        });
        res.send(`${message} <a href="/signup">Try again</a>`);
        return;
    }

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert the new user into the MongoDB database
        const result = await userCollection.insertOne({
            name, email, password: hashedPassword, user_type: 'user'
        });

        if (result.acknowledged) {
            // Set the user session upon successful signup
            req.session.authenticated = true;
            req.session.name = name;
            req.session.user_type = 'user';

            // Redirect to the members page
            res.redirect('/members');
        } else {
            throw new Error('User insertion failed');
        }
    } catch (error) {
        console.error('Signup failed:', error);
        res.status(500).send(`Error creating the account. <a href="/signup">Try again</a>`);
    }
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    // Validation schema using Joi to ensure inputs are safe and match the required format
    const schema = Joi.string().trim().email().required();
    const validationResult = schema.validate(email);
    if (validationResult.error != null) {
        res.send(`Error in input: ${validationResult.error.details[0].message} <a href="/login">Try again</a>`);
        return;
    }

    // Check if the email exists in the database
    const result = await userCollection.findOne({ email: email });
    if (!result) {
        res.send("Email not found. <a href='/signup'>Sign Up</a>");
        return;
    }

    // Check if the provided password matches the stored hashed password
    if (await bcrypt.compare(password, result.password)) {
        req.session.authenticated = true;
        req.session.name = result.name;
        req.session.email = email;
        req.session.user_type = result.user_type;
        req.session.cookie.maxAge = expireTime;
        res.redirect("/members");
    } else {
        res.send("Incorrect password. <a href='/login'>Try again</a>");
    }
});



app.use('/loggedin', sessionValidation);

app.get('/loggedin', (req,res) => {
    if (!req.session.authenticated) {
        res.redirect('/login');
    }
    res.render("loggedin", { name: req.session.name });
});





app.get('/logout', (req, res) => {
    // Destroy the session and redirect to the home page
    req.session.destroy((err) => {
        if (err) {
            console.error("Failed to destroy the session:", err);
            res.status(500).send("Could not log out.");
        } else {
            res.redirect('/');
        }
    });
});

app.use(express.static(__dirname + "/public"));

// Correct the image paths

app.get('/members', sessionValidation, (req, res) => {
    console.log("Session data:", req.session);  // Check what's stored in the session
    if (!req.session || !req.session.authenticated) {
        return res.redirect('/login');
    }
    const images = ['/images/image.jpg', '/images/image2.jpg', '/images/image3.jpg'];
    res.render("members", { name: req.session.name, images: images });
});

app.get('/admin', sessionValidation, /*adminAuthorization.,*/ async (req, res) => {
    const result = await userCollection.find().project({ name: 1, _id: 1 }).toArray();

    res.render("admin", { users: result });
});


app.use((req, res, next) => {
    res.status(404).render('404');
});

app.listen(port, () => {
    console.log("Server running on port " + port);
});
