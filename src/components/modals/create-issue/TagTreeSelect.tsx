'use client';
/**
 * Searchable, hierarchical tag picker for the create form. Supports parent/child
 * tags with tri-state checkboxes (checked / indeterminate / unchecked) and emits
 * the flat list of selected ids back to React Hook Form.
 */
import { useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import type { Tag } from '@/domain/models';
import styles from './TagTreeSelect.module.scss';

/** A tag that may contain nested child tags. */
interface TagNode extends Tag {
  children?: Tag[];
}

interface Props {
  tags: TagNode[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export default function TagTreeSelect({ tags, selectedIds, onChange }: Props) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange(Array.from(next));
  };

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filtered = tags.filter((t) => {
    const q = search.toLowerCase();
    const selfMatch = t.name.toLowerCase().includes(q);
    const childMatch = t.children?.some((c) => c.name.toLowerCase().includes(q));
    return selfMatch || childMatch;
  });

  const selectedTags = tags
    .flatMap((t) => [t, ...(t.children ?? [])])
    .filter((t) => selectedIds.includes(t.id));

  // Derive a parent's checkbox state from how many of its children are selected.
  const getCheckState = (node: TagNode): 'checked' | 'indeterminate' | 'unchecked' => {
    if (!node.children?.length) return selectedIds.includes(node.id) ? 'checked' : 'unchecked';
    const childIds = node.children.map((c) => c.id);
    const selectedCount = childIds.filter((id) => selectedIds.includes(id)).length;
    if (selectedCount === 0 && !selectedIds.includes(node.id)) return 'unchecked';
    if (selectedCount === childIds.length && selectedIds.includes(node.id)) return 'checked';
    return 'indeterminate';
  };

  const toggleParent = (node: TagNode) => {
    const state = getCheckState(node);
    const childIds = node.children?.map((c) => c.id) ?? [];
    const next = new Set(selectedIds);

    if (state === 'checked') {
      next.delete(node.id);
      childIds.forEach((id) => next.delete(id));
    } else {
      next.add(node.id);
      childIds.forEach((id) => next.add(id));
    }
    onChange(Array.from(next));
  };

  return (
    <div className={styles.root}>
      {selectedTags.length > 0 && (
        <div className={styles.chips} role="list" aria-label="Etiquetas seleccionadas">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className={styles.chip}
              style={{ backgroundColor: tag.color }}
              role="listitem"
            >
              {tag.name}
              <button
                type="button"
                className={styles.chip__remove}
                aria-label={`Quitar etiqueta ${tag.name}`}
                onClick={() => toggle(tag.id)}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className={styles.panel}>
        <div className={styles.search}>
          <input
            type="text"
            placeholder="Buscar etiqueta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar etiqueta"
          />
        </div>

        <div className={styles.tree} role="tree">
          {filtered.map((node) => {
            const state = getCheckState(node);
            const isExpanded = expanded.has(node.id);

            return (
              <div
                key={node.id}
                role="treeitem"
                aria-selected={state === 'checked'}
                aria-expanded={node.children?.length ? isExpanded : undefined}
              >
                <div
                  className={styles.node}
                  onClick={() => (node.children?.length ? toggleParent(node) : toggle(node.id))}
                >
                  {node.children?.length ? (
                    <button
                      type="button"
                      className={[
                        styles.node__expand,
                        isExpanded ? styles['node__expand--open'] : '',
                      ].join(' ')}
                      aria-label={isExpanded ? 'Colapsar' : 'Expandir'}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(node.id);
                      }}
                    >
                      <ChevronRight size={12} />
                    </button>
                  ) : (
                    <span style={{ width: 16 }} />
                  )}

                  <input
                    type="checkbox"
                    className={styles.node__checkbox}
                    checked={state === 'checked'}
                    ref={(el) => {
                      if (el) el.indeterminate = state === 'indeterminate';
                    }}
                    onChange={() => (node.children?.length ? toggleParent(node) : toggle(node.id))}
                    aria-checked={state === 'indeterminate' ? 'mixed' : state === 'checked'}
                    onClick={(e) => e.stopPropagation()}
                  />

                  <span className={styles.node__dot} style={{ backgroundColor: node.color }} />
                  <span className={styles.node__label}>{node.name}</span>
                </div>

                {node.children &&
                  isExpanded &&
                  node.children
                    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
                    .map((child) => (
                      <div
                        key={child.id}
                        className={`${styles.node} ${styles['node--child']}`}
                        role="treeitem"
                        aria-selected={selectedIds.includes(child.id)}
                        onClick={() => toggle(child.id)}
                      >
                        <span style={{ width: 16 }} />
                        <input
                          type="checkbox"
                          className={styles.node__checkbox}
                          checked={selectedIds.includes(child.id)}
                          onChange={() => toggle(child.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span
                          className={styles.node__dot}
                          style={{ backgroundColor: child.color }}
                        />
                        <span className={styles.node__label}>{child.name}</span>
                      </div>
                    ))}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <p style={{ padding: '12px 16px', fontSize: 14, color: '#8a8f98', margin: 0 }}>
              Sin resultados
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
