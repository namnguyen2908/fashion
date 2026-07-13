import express from "express";
import { verifyToken } from "../middlewares/auth.middleware.js";
import { getProducts, getProductById, getProductBySlug, createProduct, updateProduct, deleteProduct } from "../controllers/product.controller.js";
import { verifyPermission } from '../middlewares/permission.middleware.js';

const router = express.Router();

router.get("/", getProducts);
router.get("/slug/:slug", getProductBySlug);
router.get("/:id", getProductById);
router.post("/create-product", verifyToken, verifyPermission('product:create'), createProduct);
router.put("/update-product/:id", verifyToken, verifyPermission('product:update'), updateProduct);
router.delete("/delete-product/:id", verifyToken, verifyPermission('product:delete'), deleteProduct);

export default router;