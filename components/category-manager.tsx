"use client";

import { useActionState, useState } from "react";
import { FolderPlus, Pencil, Plus, Save, X } from "lucide-react";
import { createCategoryAction, updateCategoryAction } from "@/app/admin/categories/actions";
import { initialCategoryState, type CategoryFormState } from "@/lib/data/category-form";
import type { CategoryNode, CategoryRow } from "@/lib/data/categories";

// Quản lý category chạy thật (trước đây là mockup tĩnh: nút Edit/Add không có
// handler, form không có name/action). Panel bên phải dùng chung cho thêm mới
// và sửa; ghi qua server action → RLS staff.

function CategoryFields({ category, parents }: { category?: CategoryRow; parents: CategoryRow[] }) {
  const selectableParents = parents.filter((parent) => parent.id !== category?.id);
  return (
    <>
      <label>
        Name *
        <input name="name" required defaultValue={category?.name ?? ""} placeholder="Example: Frozen" />
      </label>
      <label>
        Slug
        <input name="slug" defaultValue={category?.slug ?? ""} placeholder="Leave blank to use the name" />
      </label>
      <label>
        Parent
        <select name="parentId" defaultValue={category?.parentId ?? ""}>
          <option value="">No parent</option>
          {selectableParents.map((parent) => (
            <option key={parent.id} value={parent.id}>{parent.name}</option>
          ))}
        </select>
      </label>
      <label>
        Sort order
        <input name="sortOrder" type="number" defaultValue={category?.sortOrder ?? 0} />
      </label>
      <label className="checkbox-label">
        <input name="isActive" type="checkbox" defaultChecked={category?.isActive ?? true} /> Visible in storefront
      </label>
    </>
  );
}

export function CategoryManager({ tree, parents }: { tree: CategoryNode[]; parents: CategoryRow[] }) {
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  // Đổi sau mỗi lần thêm thành công để React dựng lại form rỗng (reset input).
  const [addedCount, setAddedCount] = useState(0);
  // Thông báo dùng chung cho cả thêm và sửa: sau khi lưu xong form quay về chế
  // độ "Add", nên không thể suy ra thông báo từ state của riêng một action.
  const [notice, setNotice] = useState<CategoryFormState>(initialCategoryState);

  // Đóng chế độ sửa / reset form ngay trong action (không dùng effect —
  // setState trong effect gây cascading render và bị lint chặn).
  const [, createAction, creating] = useActionState(
    async (prevState: CategoryFormState, formData: FormData) => {
      const result = await createCategoryAction(prevState, formData);
      setNotice(result);
      if (result.status === "success") setAddedCount((count) => count + 1);
      return result;
    },
    initialCategoryState
  );

  const [, updateAction, updating] = useActionState(
    async (prevState: CategoryFormState, formData: FormData) => {
      const result = await updateCategoryAction(prevState, formData);
      setNotice(result);
      if (result.status === "success") setEditing(null);
      return result;
    },
    initialCategoryState
  );

  // Mở/đóng chế độ sửa thì bỏ thông báo cũ để không đọc nhầm kết quả trước đó.
  function selectForEdit(category: CategoryRow | null) {
    setNotice(initialCategoryState);
    setEditing(category);
  }

  return (
    <div className="category-admin-layout">
      <section className="form-card">
        <div className="form-card-heading">
          <div>
            <h2>Category tree</h2>
            <p>Select Edit to rename a category, change its parent, order, or storefront visibility.</p>
          </div>
        </div>
        <div className="category-tree-list">
          {tree.map((category) => (
            <article key={category.id}>
              <div className="category-tree-parent">
                <strong>{category.name}</strong>
                <span>/{category.slug}</span>
                {!category.isActive ? <span className="status-pill status-pending">Hidden</span> : null}
                <button type="button" onClick={() => selectForEdit(category)}>
                  <Pencil size={14} aria-hidden="true" /> Edit
                </button>
              </div>
              {category.children.length ? (
                <div className="category-tree-children">
                  {category.children.map((child) => (
                    <div key={child.id}>
                      <span>{child.name}</span>
                      <button type="button" onClick={() => selectForEdit(child)}>
                        <Pencil size={13} aria-hidden="true" /> Edit
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
          {!tree.length ? <p className="field-hint">No categories yet. Add the first one on the right.</p> : null}
        </div>
      </section>

      <aside className="form-card compact-form-card">
        <h2>{editing ? `Edit ${editing.name}` : "Add category"}</h2>

        {notice.status !== "idle" ? (
          <div className={notice.status === "success" ? "form-success" : "form-error"} role="status">
            {notice.message}
          </div>
        ) : null}

        {editing ? (
          <form className="form-grid" action={updateAction} key={editing.id}>
            <input type="hidden" name="id" value={editing.id} />
            <CategoryFields category={editing} parents={parents} />
            <div className="button-row">
              <button className="button primary" type="submit" disabled={updating}>
                <Save size={17} aria-hidden="true" /> {updating ? "Saving…" : "Save changes"}
              </button>
              <button className="button secondary" type="button" onClick={() => selectForEdit(null)}>
                <X size={16} aria-hidden="true" /> Cancel
              </button>
            </div>
          </form>
        ) : (
          <form className="form-grid" action={createAction} key={addedCount}>
            <CategoryFields parents={parents} />
            <button className="button primary" type="submit" disabled={creating}>
              {creating ? <>Adding…</> : <><Plus size={17} aria-hidden="true" /> Add category</>}
            </button>
          </form>
        )}
      </aside>
    </div>
  );
}

export function AddCategoryHeaderButton() {
  return (
    <button className="button primary" type="button" onClick={() => document.querySelector<HTMLInputElement>(".compact-form-card input[name='name']")?.focus()}>
      <FolderPlus size={17} aria-hidden="true" /> Add category
    </button>
  );
}
