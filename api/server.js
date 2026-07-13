import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import prisma from "./config/prisma.js";

//import routes
import authRoutes from "./routes/auth.js";
import categoryRoutes from "./routes/category.js";
import productRoutes from "./routes/product.js";
import productVariantsRoutes from "./routes/productVariants.js";
import productImagesRoutes from "./routes/productImages.js"
import bannerRoutes from "./routes/banner.js";
import cartRoutes from "./routes/cart.js";
import inventoryRoutes from "./routes/inventory.js";
import paymentRoutes from "./routes/payment.js";
import orderRoutes from "./routes/order.js";
import roleRoutes from "./routes/role.js";


dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
)

app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());


app.use("/api/auth", authRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/products", productRoutes);
app.use("/api/product-variants", productVariantsRoutes);
app.use("/api/product-images", productImagesRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/carts", cartRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/roles", roleRoutes);


app.get("/", (req, res) => {
  res.send("Hello World!");
});

const server = app.listen(process.env.PORT, async () => {
  try {
    await prisma.$connect();
    console.log(`Server is running on port ${process.env.PORT}`);
  } catch (error) {
    console.error("Failed to connect to database via Prisma:", error);
    process.exit(1);
  }
});

const gracefulShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  await prisma.$disconnect();
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
