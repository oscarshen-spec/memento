import type { RawMaterial, RawMaterialStatus } from '../types';

export function partitionByStatus(
  materials: RawMaterial[],
): { drawer: RawMaterial[]; gallery: RawMaterial[] } {
  return {
    drawer: materials.filter(m => m.status === 'drawer'),
    gallery: materials.filter(m => m.status === 'gallery'),
  };
}

export function reclassify(
  materials: RawMaterial[],
  id: string,
  status: RawMaterialStatus,
): RawMaterial[] {
  return materials.map(m => (m.id === id ? { ...m, status } : m));
}
