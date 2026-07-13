import express from "express";
import multer from "multer";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { getProducts, getProductById, getProductBySlug, createFullProduct, updateProduct, deleteProduct } from "../controllers/product.controller.js";
import { verifyRole } from '../middlewares/verifyRole.middleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", getProducts);
router.get("/slug/:slug", getProductBySlug);
router.get("/:id", getProductById);
router.post("/create-full", verifyToken, verifyRole('admin', 'staff'), upload.array('images', 20), createFullProduct);
router.put("/update-product/:id", verifyRole('admin', 'staff'), verifyToken, updateProduct);
router.delete("/delete-product/:id", verifyRole('admin', 'staff'), verifyToken, deleteProduct);

export default router;