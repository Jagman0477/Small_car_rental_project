const express = require("express");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const {register, getUser, login, addCar, getCar, getAvailableCars, logout, rentCar, editCar, viewableCars, getUserByID, ses} = require("./database");
const session = require("express-session");
const methodOverride = require("method-override");
var path = require('path');
const app = express();

app.use(bodyParser.urlencoded({extended: true}))
app.use(express.json())
app.use((err, req, res, next) => {
    console.error(err.stack)
    res.status(500).send("Something broken.")
})
app.use(session(ses))
const isAuth = (req, res, next) => {
    if(req.session.isAuth) return next()
    else return res.redirect("/login")
}
app.use(methodOverride('_method'))
app.use(express.static(path.join(__dirname, '/public')));
app.set('view engine', 'ejs')

// This route actually registers the user.
app.route('/afterRegister')
    .post( async (req, res) => {
        let {email, fullName, userName, type, pass} = req.body

        const userCheck = await getUser(userName)
        if(userCheck) {
            return res.render('register', {success: false, type: type})
        }
        
        // Using bcrypt to hash the password.
        let password = await bcrypt.hash(pass, 10)
        
        // Converting Date() to SQL datetime format. 
        let createdOn = new Date().toISOString().slice(0, 19).replace('T', ' ')
        let loginStatus = 0

        // Calling register() from database.js. 
        const user = await register(email, fullName, userName, password, type, createdOn, loginStatus)
        
        res.redirect("/login")
    })
    .get((req, res) => {
        if(!req.body) return res.render('errorPage', {msg: "You are not allowed here.", display: false})
        return res.render('register', {success: true, type: type})
    })

    // This route goes to the choice page.
    app.route('/register')
        .post((req, res) => {
            let {type} = req.body
            res.render('register', {type: type})
        })
        .get((req, res) => {
            if(req.session.isAuth === true) return res.redirect("/cars")
            res.render('registerChoice')
        })

    app.route('/login')
        .post( async (req, res) => {

            let {userName, password} = req.body

            // Check user existance. Calling getUser() from database.js.
            const user = await getUser(userName)
            
            if(user){
                // Compare hashed password with user edited password.
                if(await bcrypt.compare(password, user.password)){
                    if(user.login_status === 1) return res.redirect("/cars")
                    else {
                        const loggedIn = await login(user.userID)
                    if(loggedIn === 1) {
                        req.session.isAuth = true
                        req.session.user = userName
                        return res.redirect("/cars")
                        }
                    }
                    
                    } else return res.render('errorPage', {msg: "Wrong Password.", display: false})
            } else return res.render('errorPage', {msg: "Such User Doesn't exist.(Wrong username)", display: false})
        })
        .get( async (req, res) => {
            if(req.session.isAuth === true) return res.redirect("/cars")
            else return res.render('login', {success: true})
        })

    app.route("/addCar")
        .post( isAuth, async (req, res) => {
            let {vehicalModel, vehicalNumber, seatingCapacity, rentPDay} = req.body
            let addedOn = new Date().toISOString().slice(0, 19).replace('T', ' '), rentStatus = 0

            const carCheck = await getCar(vehicalNumber)
            if(carCheck) {
                return res.render('addCar', {success: false, vehical: null})
            }

            let addedBy = (await getUser(req.session.user)).userID

            const car = await addCar(vehicalNumber , vehicalModel, seatingCapacity, rentPDay, addedOn, rentStatus, addedBy)
            return res.redirect("/cars")
        })
    .get( isAuth, async (req, res) => {
        let user = await getUser(req.session.user)
        if(user.type === "a")
        return res.render("addCar", {success: true, vehical: null})
        else return res.render('errorPage', {msg: "Your account is not authorized for this.", display: true})
    })

    app.route(["/cars", "/"])
        .get( async (req, res) => {
            let type = null, user = null
            if(req.session.isAuth){
                let userName = await getUser(req.session.user)
                type = userName.type 
                user = userName
            }
            let cars = await getAvailableCars(0)
            res.render("cars", {cars: cars, type: type, userName: user, viewFlag: false, renters: null})
        })

    app.route("/logout")
        .post( isAuth, async (req, res) => {
            
            let user = await getUser(req.session.user)
            if(user.login_status === 1){
                let loggedOut = await logout(user.userID)
                req.session.destroy((err) => {
                    if(err) throw err;
                    else return res.redirect("/login")
                })
            } else return res.redirect("/login")
        })

    app.route("/rentCar")
        .post( isAuth, async(req, res) => {
            let {daysToRent, vehicalNumber} = req.body
            let userId = (await getUser(req.session.user)).userID
            let rentedOn = new Date().toISOString().slice(0, 19).replace('T', ' ')
            
            const rented = await rentCar(userId, vehicalNumber, rentedOn)
            if(rented) {
                let rentPDay = (await getCar(vehicalNumber)).rent_per_day
                let totalRent = rentPDay*daysToRent
                return res.render('errorPage', {msg: totalRent, display: true})
            }
        })

    app.route("/editCar")
        .post( isAuth, async (req, res) => {
            let {vehicalNumber} = req.body
            let car = await getCar(vehicalNumber)
            if(car.rent_status === 1) return res.render('errorPage', {msg: "You canno't edit a rented car.", display: true})
            res.render('addCar', {success: true, vehical: car})
        })
        // .put( isAuth, async(req, res) => {

        // })

    app.route("/editCarProxy")
        .patch( isAuth, async (req, res) => {
            let {vehicalModel, vehicalNumber, seatingCapacity, rentPDay} = req.body
            
            const carCheck = await getCar(vehicalNumber)

            if(!carCheck) {
                return res.render('addCar', {success: false, vehical: null})
            } else {
                const car = await editCar(vehicalNumber , vehicalModel, seatingCapacity, rentPDay)
                return res.redirect("/cars")
            }
        })

    app.route("/viewBookedCars")
        .get( isAuth, async(req, res) => {
            let renters = []
            let user = await getUser(req.session.user)
            if(user.type === "a"){
                let cars = await viewableCars(user.userID)
                if(cars){
                    for(let i=0; i<cars.length;i++){
                        let temp = (await getUserByID(cars[i].added_by)).full_name
                        renters.push( temp )
                        console.log(renters);
                    }
                }
                res.render('cars', {cars: cars, type: (await getUser(req.session.user)).type, userName: user, viewFlag: true, renters: renters})
            } else return res.render('errorPage', {msg: "Not authorized for this.(Only availabe for agency users)", display: true})
        })

    app.listen(3000, function(err){
        if(!err)
            console.log("Server is running at port 3000");
        else throw(err);
    })
