import pool from '../config/db.js';

export function effectivePriceSubquery(variantIdExpr) {
    return `(
        SELECT jsonb_build_object(
            'price', COALESCE((SELECT price FROM variant_prices WHERE variant_id = ${variantIdExpr}), 0),
            'sale_price', (SELECT sv.sale_price FROM sale_variants sv JOIN sales s ON sv.sale_id = s.id
                           WHERE sv.variant_id = ${variantIdExpr} AND s.is_active = true
                           AND NOW() BETWEEN s.starts_at AND s.expires_at ORDER BY sv.sale_price ASC LIMIT 1),
            'is_on_sale', EXISTS(SELECT 1 FROM sale_variants sv JOIN sales s ON sv.sale_id = s.id
                                 WHERE sv.variant_id = ${variantIdExpr} AND s.is_active = true
                                 AND NOW() BETWEEN s.starts_at AND s.expires_at)
        )
    )`;
}

export function formatPriceData(row, field = 'price_data') {
    const pd = row[field] || {};
    return {
        ...row,
        price: Number(pd.price) || 0,
        sale_price: pd.sale_price ? Number(pd.sale_price) : null,
        is_on_sale: !!pd.is_on_sale,
        effective_price: pd.sale_price ? Number(pd.sale_price) : (Number(pd.price) || 0),
        original_price: pd.is_on_sale ? (Number(pd.price) || 0) : null,
        discount_percent: pd.sale_price && Number(pd.price) > 0
            ? Math.round((1 - Number(pd.sale_price) / Number(pd.price)) * 100)
            : null,
        [field]: undefined
    };
}
