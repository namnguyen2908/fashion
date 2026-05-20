import express from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { getProducts, getProductById, createProduct, updateProduct, deleteProduct } from "../controllers/product.controller.js";
import { verifyRole } from '../middlewares/verifyRole.middleware.js';

const router = express.Router();

router.get("/", getProducts);
router.get("/:id", getProductById);
router.post("/create-product", verifyToken, verifyRole('admin', 'staff'), createProduct);
router.put("/update-product/:id", verifyRole('admin', 'staff'), verifyToken, updateProduct);
router.delete("/delete-product/:id", verifyRole('admin', 'staff'), verifyToken, deleteProduct);

export default router;