import { FolderPlus, GripVertical, Plus } from "lucide-react";
import { AdminPageHeader } from "@/components/admin-page-header";
import { categories } from "@/lib/sample-data";

export default function CategoriesPage() {
  return (
    <>
      <AdminPageHeader eyebrow="Catalog" title="Categories" description="Create nested categories and control the dropdown order shown in the storefront." action={<button className="button primary" type="button"><FolderPlus size={17} /> Add category</button>} />
      <div className="category-admin-layout">
        <section className="form-card">
          <div className="form-card-heading"><div><h2>Category tree</h2><p>Drag controls are visual placeholders; persist sort_order in Supabase.</p></div></div>
          <div className="category-tree-list">
            {categories.map((category) => (
              <article key={category.slug}>
                <div className="category-tree-parent"><GripVertical size={18} /><strong>{category.name}</strong><span>/{category.slug}</span><button type="button">Edit</button></div>
                <div className="category-tree-children">{category.children.map((child) => <div key={child}><GripVertical size={15} /><span>{child}</span><button type="button">Edit</button></div>)}</div>
              </article>
            ))}
          </div>
        </section>
        <aside className="form-card compact-form-card">
          <h2>Add category</h2>
          <form className="form-grid"><label>Name<input placeholder="Example: Frozen" /></label><label>Slug<input placeholder="frozen" /></label><label>Parent<select><option>No parent</option>{categories.map((category) => <option key={category.slug}>{category.name}</option>)}</select></label><label>Sort order<input type="number" defaultValue="0" /></label><label className="checkbox-label"><input type="checkbox" defaultChecked /> Visible in storefront</label><button className="button primary" type="button"><Plus size={17} /> Add category</button></form>
        </aside>
      </div>
    </>
  );
}
