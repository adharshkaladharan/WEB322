/*********************************************************************************
WEB322 – Assignment 06
I declare that this assignment is my own work in accordance with Seneca Academic Policy. No part * of this assignment has
been copied manually or electronically from any other source (including 3rd party web sites) or distributed to other students.
Name: Adharsh Nellikode Kaladharan
Student ID: 167892223
Date: 18-04-2025
Cyclic Web App URL:https://web322-u6lz.onrender.com 
GitHub Repository URL: https://github.com/adharshkaladharan/WEB322.git
********************************************************************************/

const express = require("express");
const path = require("path");
const storeService = require("./store-service");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const exphbs = require('express-handlebars');
const Handlebars = require('handlebars');
const authData = require('./auth-service');
const clientSessions = require('client-sessions');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 8080;

cloudinary.config({
    cloud_name: "dkfie9bh4",
    api_key: "197672481759547",
    api_secret: "3wRPoCnIDhAVkuJPfYSQ8eiZozw",
    secure: true
});

const upload = multer();

app.engine('.hbs', exphbs.engine({
    extname: '.hbs',
    defaultLayout: 'main',
    helpers: {
        navLink: function (url, options) {
            return '<li' + ((url == app.locals.activeRoute) ? ' class="active"' : '') +
                '><a href="' + url + '" class="nav-link">' + options.fn(this) + '</a></li>';
        },
        equal: function (lvalue, rvalue, options) {
            return (lvalue == rvalue) ? options.fn(this) : options.inverse(this);
        },
        safeHTML: function (html) {
            return new Handlebars.SafeString(html);
        },
        formatDate: function (dateObj) {
            let year = dateObj.getFullYear();
            let month = (dateObj.getMonth() + 1).toString();
            let day = dateObj.getDate().toString();
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
    }
}));

app.set('view engine', '.hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

app.use(clientSessions({
    cookieName: "session",
    secret: "random_secret_key_123",
    duration: 2 * 60 * 1000,
    activeDuration: 1000 * 60
}));

app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

app.use((req, res, next) => {
    let route = req.path.substring(1);
    app.locals.activeRoute = "/" + (isNaN(route.split('/')[1]) ? route.replace(/\/(?!.*)/, "") : route.replace(/\/(.*)/, ""));
    app.locals.viewingCategory = req.query.category;
    next();
});

const ensureLogin = (req, res, next) => {
    if (!req.session.user) {
        res.redirect("/login");
    } else {
        next();
    }
};

app.get("/", (req, res) => res.redirect("/shop"));
app.get("/about", (req, res) => res.render("about"));

app.get("/register", (req, res) => res.render("register"));
app.post("/register", async (req, res) => {
    if (req.body.password !== req.body.password2) {
        return res.render('register', { errorMessage: 'Passwords do not match', userName: req.body.userName });
    }

    try {
        const hash = await bcrypt.hash(req.body.password, 10);
        req.body.password = hash;
        await authData.registerUser(req.body);
        res.render('register', { successMessage: "User created", userName: req.body.userName });
    } catch (err) {
        res.render('register', { errorMessage: err, userName: req.body.userName });
    }
});

app.get("/login", (req, res) => res.render("login"));
app.post("/login", (req, res) => {
    req.body.userAgent = req.get('User-Agent');
    authData.checkUser(req.body)
        .then(user => {
            req.session.user = {
                userName: user.userName,
                email: user.email,
                loginHistory: user.loginHistory
            };
            res.redirect('/items');
        })
        .catch(err => res.render('login', { errorMessage: err, userName: req.body.userName }));
});

app.get("/logout", (req, res) => {
    req.session.reset();
    res.redirect("/");
});

app.get("/userHistory", ensureLogin, (req, res) => {
    res.render("userHistory");
});

app.get("/items", ensureLogin, (req, res) => {
    storeService.getAllItems()
        .then(items => res.render("items", { items }))
        .catch(() => res.render("items", { message: "No items found." }));
});

app.get("/items/add", ensureLogin, (req, res) => {
    storeService.getCategories()
        .then(categories => res.render("addItem", { categories }))
        .catch(() => res.render("addItem", { categories: [] }));
});

app.post("/items/add", ensureLogin, upload.single("featureImage"), (req, res) => {
    if (req.file) {
        const streamUpload = (req) => {
            return new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream((error, result) => {
                    if (result) {
                        resolve(result);
                    } else {
                        reject(error);
                    }
                });
                streamifier.createReadStream(req.file.buffer).pipe(stream);
            });
        };

        async function upload(req) {
            let result = await streamUpload(req);
            return result;
        }

        upload(req).then((uploaded) => {
            processItem(uploaded.url);
        });
    } else {
        processItem("");
    }

    function processItem(imageUrl) {
        req.body.featureImage = imageUrl;
        storeService.addItem(req.body).then(() => {
            res.redirect("/items");
        }).catch(() => {
            res.status(500).send("Unable to add item");
        });
    }
});

app.get("/categories", ensureLogin, (req, res) => {
    storeService.getCategories()
        .then(categories => res.render("categories", { categories }))
        .catch(() => res.render("categories", { message: "no results" }));
});

app.get("/categories/add", ensureLogin, (req, res) => {
    res.render("addCategory");
});

app.post("/categories/add", ensureLogin, (req, res) => {
    storeService.addCategory(req.body)
        .then(() => res.redirect("/categories"))
        .catch(() => res.status(500).send("Unable to add category"));
});

app.get("/categories/delete/:id", ensureLogin, (req, res) => {
    storeService.deleteCategoryById(req.params.id)
        .then(() => res.redirect("/categories"))
        .catch(() => res.status(500).send("Unable to Remove Category / Category not found"));
});

app.get("/shop", async (req, res) => {
    let viewData = {};
    try {
        let items = await storeService.getPublishedItems();
        items.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));
        viewData.items = items;
        viewData.item = items[0];
    } catch (err) {
        viewData.message = "no results";
    }
    try {
        viewData.categories = await storeService.getCategories();
    } catch (err) {
        viewData.categoriesMessage = "no results";
    }
    res.render("shop", { data: viewData });
});

app.get("/shop/:id", async (req, res) => {
    let viewData = {};
    try {
        let items = await storeService.getPublishedItems();
        items.sort((a, b) => new Date(b.postDate) - new Date(a.postDate));
        viewData.items = items;
    } catch (err) {
        viewData.message = "no results";
    }
    try {
        viewData.item = await storeService.getItemById(req.params.id);
    } catch (err) {
        viewData.message = "no results";
    }
    try {
        viewData.categories = await storeService.getCategories();
    } catch (err) {
        viewData.categoriesMessage = "no results";
    }
    res.render("shop", { data: viewData });
});

app.use((req, res) => {
    res.status(404).render("404");
});

storeService.initialize()
    .then(authData.initialize)
    .then(() => {
        app.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`));
    })
    .catch(err => {
        console.log(`Failed to initialize services: ${err}`);
    });
