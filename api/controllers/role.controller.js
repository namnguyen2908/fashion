import pool from '../config/db.js';
import { deleteCache } from '../utils/cache.js';
import { generateSlug } from '../utils/slugify.js';

export const getRoles = async (req, res) => {
    try {
        const roles = await pool.query(`
            SELECT r.id, r.name, r.slug, r.description, r.is_system, r.created_at,
                   COALESCE(
                       json_agg(
                           json_build_object(
                               'id', p.id,
                               'name', p.name,
                               'slug', p.slug,
                               'group', p."group"
                           )
                       ) FILTER (WHERE p.id IS NOT NULL),
                       '[]'
                   ) AS permissions
            FROM roles r
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            LEFT JOIN permissions p ON rp.permission_id = p.id
            GROUP BY r.id
            ORDER BY r.id
        `);

        return res.status(200).json(roles.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server Error' });
    }
};

export const getRoleById = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT r.id, r.name, r.slug, r.description, r.is_system, r.created_at,
                   COALESCE(
                       json_agg(
                           json_build_object(
                               'id', p.id,
                               'name', p.name,
                               'slug', p.slug,
                               'group', p."group"
                           )
                       ) FILTER (WHERE p.id IS NOT NULL),
                       '[]'
                   ) AS permissions
            FROM roles r
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            LEFT JOIN permissions p ON rp.permission_id = p.id
            WHERE r.id = $1
            GROUP BY r.id
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Role not found' });
        }

        return res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server Error' });
    }
};

export const createRole = async (req, res) => {
    try {
        const { name, slug: rawSlug, description } = req.body;
        const slug = rawSlug || generateSlug(name || '').replace(/-/g, '_');

        if (!name) {
            return res.status(400).json({ message: 'Name is required' });
        }

        const existing = await pool.query('SELECT id FROM roles WHERE slug = $1', [slug]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ message: 'Role with this slug already exists' });
        }

        const newRole = await pool.query(
            `INSERT INTO roles (name, slug, description) VALUES ($1, $2, $3) RETURNING *`,
            [name, slug, description]
        );

        return res.status(201).json(newRole.rows[0]);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server Error' });
    }
};

export const updateRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, slug, description } = req.body;

        const role = await pool.query('SELECT * FROM roles WHERE id = $1', [id]);
        if (role.rows.length === 0) {
            return res.status(404).json({ message: 'Role not found' });
        }

        if (role.rows[0].is_system) {
            return res.status(400).json({ message: 'Cannot edit system roles' });
        }

        if (slug && slug !== role.rows[0].slug) {
            const existing = await pool.query(
                'SELECT id FROM roles WHERE slug = $1 AND id != $2',
                [slug, id]
            );
            if (existing.rows.length > 0) {
                return res.status(400).json({ message: 'Role with this slug already exists' });
            }
        }

        const updated = await pool.query(
            `UPDATE roles SET name = COALESCE($1, name), slug = COALESCE($2, slug), description = COALESCE($3, description)
             WHERE id = $4 RETURNING *`,
            [name, slug, description, id]
        );

        await deleteCache(`role:permissions:${role.rows[0].slug}`);

        return res.status(200).json(updated.rows[0]);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server Error' });
    }
};

export const deleteRole = async (req, res) => {
    try {
        const { id } = req.params;

        const role = await pool.query('SELECT * FROM roles WHERE id = $1', [id]);
        if (role.rows.length === 0) {
            return res.status(404).json({ message: 'Role not found' });
        }

        if (role.rows[0].is_system) {
            return res.status(400).json({ message: 'Cannot delete system roles' });
        }

        const usersWithRole = await pool.query(
            'SELECT COUNT(*) FROM users WHERE role = $1',
            [role.rows[0].slug]
        );
        if (parseInt(usersWithRole.rows[0].count) > 0) {
            return res.status(400).json({
                message: `Cannot delete role "${role.rows[0].name}" because it is assigned to ${usersWithRole.rows[0].count} user(s). Reassign them first.`
            });
        }

        await deleteCache(`role:permissions:${role.rows[0].slug}`);

        await pool.query('DELETE FROM roles WHERE id = $1', [id]);

        return res.status(200).json({ message: 'Role deleted successfully' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server Error' });
    }
};

export const getPermissions = async (req, res) => {
    try {
        const { group } = req.query;

        let query = 'SELECT * FROM permissions';
        const params = [];

        if (group) {
            query += ' WHERE "group" = $1';
            params.push(group);
        }

        query += ' ORDER BY "group", id';

        const result = await pool.query(query, params);
        return res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server Error' });
    }
};

export const getPermissionsGrouped = async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT "group", json_agg(
                json_build_object('id', id, 'name', name, 'slug', slug, 'description', description)
                ORDER BY id
            ) AS permissions
            FROM permissions
            GROUP BY "group"
            ORDER BY "group"
        `);

        return res.status(200).json(result.rows);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server Error' });
    }
};

export const assignPermissions = async (req, res) => {
    try {
        const { id } = req.params;
        const { permission_ids } = req.body;

        if (!Array.isArray(permission_ids)) {
            return res.status(400).json({ message: 'permission_ids must be an array' });
        }

        const role = await pool.query('SELECT * FROM roles WHERE id = $1', [id]);
        if (role.rows.length === 0) {
            return res.status(404).json({ message: 'Role not found' });
        }

        if (permission_ids.length > 0) {
            const valid = await pool.query(
                'SELECT id FROM permissions WHERE id = ANY($1)',
                [permission_ids]
            );
            if (valid.rows.length !== permission_ids.length) {
                return res.status(400).json({ message: 'One or more permission IDs are invalid' });
            }
        }

        await pool.query('DELETE FROM role_permissions WHERE role_id = $1', [id]);

        if (permission_ids.length > 0) {
            const placeholders = permission_ids.map((_, i) => `($1, $${i + 2})`).join(', ');
            await pool.query(
                `INSERT INTO role_permissions (role_id, permission_id) VALUES ${placeholders}`,
                [id, ...permission_ids]
            );
        }

        await deleteCache(`role:permissions:${role.rows[0].slug}`);

        const updatedRole = await pool.query(`
            SELECT r.id, r.name, r.slug, r.description, r.is_system, r.created_at,
                   COALESCE(
                       json_agg(
                           json_build_object('id', p.id, 'name', p.name, 'slug', p.slug, 'group', p."group")
                       ) FILTER (WHERE p.id IS NOT NULL),
                       '[]'
                   ) AS permissions
            FROM roles r
            LEFT JOIN role_permissions rp ON r.id = rp.role_id
            LEFT JOIN permissions p ON rp.permission_id = p.id
            WHERE r.id = $1
            GROUP BY r.id
        `, [id]);

        return res.status(200).json(updatedRole.rows[0]);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server Error' });
    }
};

export const updateUserRole = async (req, res) => {
    try {
        const { id } = req.params;
        const { role_slug } = req.body;

        if (!role_slug) {
            return res.status(400).json({ message: 'role_slug is required' });
        }

        const role = await pool.query('SELECT * FROM roles WHERE slug = $1', [role_slug]);
        if (role.rows.length === 0) {
            return res.status(400).json({ message: 'Role not found' });
        }

        const user = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
        if (user.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const updated = await pool.query(
            'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, name, email, role',
            [role_slug, id]
        );

        return res.status(200).json({
            message: 'User role updated successfully',
            user: updated.rows[0]
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Server Error' });
    }
};
