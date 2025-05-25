import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

/-----------ESTABLISHING CONNECTION TO MONGODB-----/;
const connectDB = async () => {
  try {
    /-----------Connecting to MongoDB----------------------/;

    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}/${DB_NAME}`
    );
    console.log(
      `\n MONGODB CONNECTED !! DB : HOST ${connectionInstance.connection.host}`
    );
    console.log(connectionInstance);
  } catch (error) {
    console.log("MONGODB CONNECTION ERROR ", error);
    process.exit(1);
  }
};

export default connectDB;
