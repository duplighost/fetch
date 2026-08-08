import { BufferAttribute, BufferGeometry } from 'three';

function cloneAttribute(attribute) {
  if (attribute.isInterleavedBufferAttribute) {
    const array = [];
    for (let i = 0; i < attribute.count; i++) {
      for (let c = 0; c < attribute.itemSize; c++) array.push(attribute.getComponent(i, c));
    }
    return new BufferAttribute(new attribute.array.constructor(array), attribute.itemSize, attribute.normalized);
  }
  return attribute.clone();
}

function mergeAttributes(attributes) {
  let TypedArray;
  let itemSize;
  let normalized;
  let gpuType;
  let arrayLength = 0;

  for (const attribute of attributes) {
    if (!TypedArray) TypedArray = attribute.array.constructor;
    if (TypedArray !== attribute.array.constructor) return null;
    if (itemSize === undefined) itemSize = attribute.itemSize;
    if (itemSize !== attribute.itemSize) return null;
    if (normalized === undefined) normalized = attribute.normalized;
    if (normalized !== attribute.normalized) return null;
    if (gpuType === undefined) gpuType = attribute.gpuType;
    if (gpuType !== attribute.gpuType) return null;
    arrayLength += attribute.count * itemSize;
  }

  const array = new TypedArray(arrayLength);
  let offset = 0;
  for (const source of attributes) {
    const attr = source.isInterleavedBufferAttribute ? cloneAttribute(source) : source;
    array.set(attr.array, offset);
    offset += attr.array.length;
  }

  const merged = new BufferAttribute(array, itemSize, normalized);
  if (gpuType !== undefined) merged.gpuType = gpuType;
  return merged;
}

export function mergeGeometries(geometries, useGroups = false) {
  if (!Array.isArray(geometries) || geometries.length === 0) return null;

  const isIndexed = geometries[0].index !== null;
  const attributesUsed = new Set(Object.keys(geometries[0].attributes));
  const morphAttributesUsed = new Set(Object.keys(geometries[0].morphAttributes || {}));
  const morphTargetsRelative = geometries[0].morphTargetsRelative;

  const attributes = {};
  const morphAttributes = {};
  const mergedGeometry = new BufferGeometry();
  let offset = 0;

  for (let i = 0; i < geometries.length; ++i) {
    const geometry = geometries[i];
    let attributesCount = 0;

    if ((geometry.index !== null) !== isIndexed) return null;
    if (geometry.morphTargetsRelative !== morphTargetsRelative) return null;

    for (const name in geometry.attributes) {
      if (!attributesUsed.has(name)) return null;
      if (attributes[name] === undefined) attributes[name] = [];
      attributes[name].push(geometry.attributes[name]);
      attributesCount++;
    }
    if (attributesCount !== attributesUsed.size) return null;

    for (const name in geometry.morphAttributes) {
      if (!morphAttributesUsed.has(name)) return null;
      if (morphAttributes[name] === undefined) morphAttributes[name] = [];
      morphAttributes[name].push(geometry.morphAttributes[name]);
    }

    if (useGroups) {
      let count;
      if (isIndexed) count = geometry.index.count;
      else if (geometry.attributes.position !== undefined) count = geometry.attributes.position.count;
      else return null;
      mergedGeometry.addGroup(offset, count, i);
      offset += count;
    }
  }

  if (isIndexed) {
    let indexOffset = 0;
    const mergedIndex = [];
    for (const geometry of geometries) {
      const index = geometry.index;
      for (let j = 0; j < index.count; ++j) mergedIndex.push(index.getX(j) + indexOffset);
      indexOffset += geometry.attributes.position.count;
    }
    mergedGeometry.setIndex(mergedIndex);
  }

  for (const name in attributes) {
    const mergedAttribute = mergeAttributes(attributes[name]);
    if (!mergedAttribute) return null;
    mergedGeometry.setAttribute(name, mergedAttribute);
  }

  for (const name in morphAttributes) {
    const numMorphTargets = morphAttributes[name][0].length;
    if (numMorphTargets === 0) continue;
    mergedGeometry.morphAttributes[name] = [];
    for (let i = 0; i < numMorphTargets; ++i) {
      const morphAttrsToMerge = [];
      for (let j = 0; j < morphAttributes[name].length; ++j) {
        morphAttrsToMerge.push(morphAttributes[name][j][i]);
      }
      const mergedMorphAttribute = mergeAttributes(morphAttrsToMerge);
      if (!mergedMorphAttribute) return null;
      mergedGeometry.morphAttributes[name].push(mergedMorphAttribute);
    }
  }

  return mergedGeometry;
}

export function mergeBufferGeometries(geometries, useGroups = false) {
  return mergeGeometries(geometries, useGroups);
}

export function estimateBytesUsed(geometry) {
  let mem = 0;
  for (const name in geometry.attributes) {
    const attr = geometry.getAttribute(name);
    mem += attr.count * attr.itemSize * attr.array.BYTES_PER_ELEMENT;
  }
  const indices = geometry.getIndex();
  if (indices) mem += indices.count * indices.itemSize * indices.array.BYTES_PER_ELEMENT;
  return mem;
}
