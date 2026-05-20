import pool from '../config/db.js';
import { generateSlug } from '../utils/slugify.js';

export const getCategories = async (req, res) =>{
    try {
        const categories = await pool.query('SELECT c.id, c.name, c.slug, c.parent_id, p.name AS parent_name FROM categories c LEFT JOIN categories p ON c.parent_id = p.id ORDER BY c.id DESC');

        return res.status(200).json(categories.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server Error' });
    }
}

export const getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);

        if (category.rows.length === 0) {
            return res.status(404).json({ message: 'Category not found' });
        }

        return res.status(200).json(category.rows[0]);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server Error' });
    }
}

export const createCategory = async (req, res) => {
    try {
        const { name, parent_id } = req.body;

        if(!name){
            return res.status(400).json({ message: 'Name is required' });
        }

        const slug = generateSlug(name);

        const existingCategory = await pool.query('SELECT id FROM categories WHERE slug = $1', [slug]);

        if (existingCategory.rows.length > 0) {
            return res.status(400).json({ message: 'Category with the same name already exists' });
        }

        if (parent_id) {
            const parentCategory = await pool.query('SELECT * FROM categories WHERE id = $1', [parent_id]);
            console.log("parentCategory.rows[0].parent_id:", parentCategory.rows[0].parent_id);
            if (parentCategory.rows.length === 0) {
                return res.status(400).json({ message: 'Parent category not found' });
            }

            if (parentCategory.rows[0].parent_id !== null) {
                return res.status(400).json({ message: 'Parent category cannot be a child category' });
            }
        }

        const newCategory = await pool.query('insert into categories (name, slug, parent_id) values ($1, $2, $3) returning *', [name, slug, parent_id]);

        return res.status(201).json(newCategory.rows[0]);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server Error' });
    }
}

export const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, parent_id } = req.body;

        const category = await pool.query('SELECT * FROM categories WHERE id = $1', [id]);

        if (category.rows.length === 0) {
            return res.status(404).json({ message: 'Category not found' });
        }

        const slug = generateSlug(name);

        const existingCategory = await pool.query('SELECT id FROM categories WHERE slug = $1 AND id != $2', [slug, id]);

        if (existingCategory.rows.length > 0) {
            return res.status(400).json({ message: 'Category with the same name already exists' });
        }

        if (Number(parent_id) === Number(id)) {
            return res.status(400).json({ message: 'Category cannot be its own parent' });
        }

        const updatedCategory = await pool.query('UPDATE categories SET name = $1, slug = $2, parent_id = $3 WHERE id = $4 RETURNING *', [name, slug, parent_id, id]);

        return res.status(200).json(updatedCategory.rows[0]);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server Error' });
    }
}

export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        const productCheck = await pool.query('SELECT id FROM products WHERE category_id = $1 LIMIT 1', [id]);

        if (productCheck.rows.length > 0) {
            return res.status(400).json({ message: 'Cannot delete category with associated products' });
        }

        const category = await pool.query('SELECT id FROM categories WHERE id = $1', [id]);

        if (category.rows.length === 0) {
            return res.status(404).json({ message: 'Category not found' });
        }

        await pool.query('DELETE FROM categories WHERE id = $1', [id]);

        return res.status(200).json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server Error' });
    }
}