const mysql = require("mysql2");
const session = require("express-session");
const dotenv = require("dotenv");
const MySQLStore = require('express-mysql-session')(session);
dotenv.config();

const pool = mysql.createPool({
    host: process.env.HOST,
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE
}).promise()

const sessionStore = new MySQLStore({}, pool)

const ses = {
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    store: sessionStore
}

const register = async (email, fullName, userName, password, type, createdOn, loginStatus) => {
    const result = await pool.query('INSERT into users (email, full_name, user_name, password, type, created_on, login_status) values (?,?,?,?,?,?,?);',
        [email, fullName, userName, password, type, createdOn, loginStatus])
        
    return result
}

const getUser = async (userName) => {
    const result = await pool.query('SELECT * from users where user_name = ?;', [userName])
    return result[0][0]
}

const login = async (id) => {
    const result = await pool.query('UPDATE users set login_status = 1 where userID = ?;', [id])
    console.log(result);
    return result[0].affectedRows
}

const logout = async (id) => {
    const result = await pool.query('UPDATE users set login_status = 0 where userID = ?;', [id])
    return result[0].affectedRows
}

const addCar = async (vehicalNumber , vehicalModel, seatingCapacity, rentPDay, addedOn, rentStatus, addedBy) => {
    const result = pool.query('INSERT into cars (vehical_number, vehical_model, seating_capacity, rent_per_day, added_on, rent_status, added_by) values (?,?,?,?,?,?,?)',
        [vehicalNumber , vehicalModel, seatingCapacity, rentPDay, addedOn, rentStatus, addedBy])
        return result
}

const getCar = async (vehicalNumber) => {
    const result = await pool.query('SELECT * from cars where vehical_number = ?;', [vehicalNumber])
    return result[0][0]
}

const editCar = async (vehicalNumber , vehicalModel, seatingCapacity, rentPDay) => {
    const result = await pool.query('UPDATE cars set vehical_number = ?, vehical_model = ?, seating_capacity = ?, rent_per_day = ? where vehical_number = ?;', 
        [vehicalNumber , vehicalModel, seatingCapacity, rentPDay, vehicalNumber])
    return result[0].affectedRows
}

const getAvailableCars = async (rentStatus) => {
    const result = await pool.query('SELECT * from cars where rent_status = ?;', [rentStatus])
    return result[0]
}

const viewableCars = async (user) => {
    const result = await pool.query('SELECT * from cars where rent_status = 1 AND added_by = ?;', [user])
    return result[0]
}

const rentCar = async (userID, vehicalNumber, rentedOn) => {
    const result = await pool.query('INSERT into rented (userID, vehical_number, rented_on) values (?,?,?);',
        [userID, vehicalNumber, rentedOn])
    const carUpdate = await pool.query('UPDATE cars set rent_status = 1 where vehical_number = ?;', [vehicalNumber])
    console.log(result[0].affectedRows+carUpdate[0].affectedRows);
    if(result[0].affectedRows+carUpdate[0].affectedRows == 2) return true
    else return false
}

const getUserByID = async(userID) => {
    const result = await pool.query('SELECT * from users where userID = ?;', [userID])
    return result[0][0]
}

module.exports = {register, getUser, login, logout, addCar, getCar, getAvailableCars, rentCar, editCar, viewableCars, getUserByID, ses}