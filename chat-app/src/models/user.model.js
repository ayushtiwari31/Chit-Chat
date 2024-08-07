import mongoose, {Schema} from "mongoose";
import bcrypt from "bcrypt"


const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
},
email: {
    type: String,
    required: true,
    unique: true,
},
password: {
    type: String,
    required: true,
}, 
online: { 
    type: Boolean, 
    default: false 
},
token: {
    type: String
}
});

// userSchema.pre('save', async function (next) {
//   if (!this.isModified('password')) {
//     next();
//   }
//   const salt = await bcrypt.genSalt(10);
//   this.password = await bcrypt.hash(this.password, salt);
//   next();
// });

export const Users = mongoose.model('Users', userSchema);


