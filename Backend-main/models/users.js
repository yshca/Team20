const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const studentSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    school: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    phoneNo: {
      type: String,
      required: true,
      unique: true,
    },
    tag: {
      type: String,
      required: true,
    },
    course = [
      {
        courseId:{
          type: String,
          required: true
        },
        progress:{
          type:Number,
          default: 0,
        }
      }
    ]
  });

var Student = mongoose.model('User', studentSchema);
module.exports = Student;