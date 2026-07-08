import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import api from "../services/api";
import SiteHeader from "../components/SiteHeader";
import SiteFooter from "../components/SiteFooter";

const buildCategoryTree = (flatCategories) => {
  const parents = flatCategories.filter((c) => c.parent_id == null);
  return parents.map((parent) => ({
    ...parent,
    children: flatCategories.filter((c) => c.parent_id === parent.id),
  }));
};

export default function PublicLayout() {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    api
      .get("/categories")
      .then((res) => setCategories(res.data ?? []))
      .catch(() => setCategories([]));
  }, []);

  const categoryTree = buildCategoryTree(categories);

  return (
    <div className="min-h-screen bg-white text-neutral-900 antialiased">
      <div className="sticky top-0 z-50">
        <div className="w-full bg-black text-white text-[10px] sm:text-xs uppercase py-1.5 sm:py-2 tracking-[0.15em] sm:tracking-widest text-center px-3 leading-relaxed">
          Miễn phí vận chuyển cho đơn hàng từ 2 triệu đồng
        </div>
        <SiteHeader categoryTree={categoryTree} />
      </div>

      <Outlet />

      <SiteFooter />
    </div>
  );
}
