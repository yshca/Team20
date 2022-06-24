const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

const app = express();
app.use(bodyParser.json());
app.set("view engine", "ejs");
app.use(express.static("public"));

app.get("/",(req,res)=>{
 res.send("Welcome to TEAM 20");
});

const port = process.env.PORT || 5000;
app.listen(port,()=>{console.log("Server started at port 5000")});