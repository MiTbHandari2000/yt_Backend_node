import "dotenv/config"; ////change if any problem occure
import connectDB from "./db/index.js";
import { app } from "./app.js";

connectDB()
  .then(() => {
    /-REGISTER AN ERROR LISTNER-/;

    app.on("error", (err) => {
      console.log("ERR:", err);
      throw err;
    });

    /-START THE EXPRESS SERVER ON SPECIFIED PORT-/;

    app.listen(process.env.PORT || 8000, () => {
      console.log(`server is running at port: ${process.env.PORT}`);
    });
  })

  .catch((err) => {
    console.log("MONGO DB CONNECTION FAIL  !!", err);
  });
