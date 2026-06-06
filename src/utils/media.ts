/**
 * Media reference tracking utilities
 */

/**
 * Recursively extracts R2 media keys (e.g. 'uploads/xxxx.png') from any content (string or JSON)
 */
export function extractMediaKeys(obj: any): string[] {
  const keys: string[] = [];
  if (!obj) return keys;
  
  if (typeof obj === 'string') {
    // Replace JSON-escaped slashes first to prevent detection failure
    const cleanStr = obj.replace(/\\\//g, '/');
    // Regular expression to match paths containing 'uploads/' without being truncated by space
    const regex = /(?:https?:\/\/[^"'()<>]+)?\/?uploads\/[^"'()<>]+/g;
    const matches = cleanStr.match(regex);
    if (matches) {
      matches.forEach(match => {
        const idx = match.indexOf('uploads/');
        if (idx !== -1) {
          let cleanKey = match.substring(idx).split('?')[0].trim();
          try {
            // Decode URL-encoded characters like %20 to match raw keys in R2/D1
            cleanKey = decodeURIComponent(cleanKey);
          } catch (e) {
            // Fallback to original if decoding fails
          }
          if (cleanKey && !keys.includes(cleanKey)) {
            keys.push(cleanKey);
          }
        }
      });
    }
  } else if (Array.isArray(obj)) {
    obj.forEach(item => {
      const subKeys = extractMediaKeys(item);
      subKeys.forEach(k => {
        if (!keys.includes(k)) keys.push(k);
      });
    });
  } else if (typeof obj === 'object') {
    Object.values(obj).forEach(val => {
      const subKeys = extractMediaKeys(val);
      subKeys.forEach(k => {
        if (!keys.includes(k)) keys.push(k);
      });
    });
  }
  return keys;
}

/**
 * Updates D1 media_references table for a given entity
 * Removes old references and inserts new ones in a batch transaction
 */
export async function updateMediaReferences(
  db: any,
  entityType: string,
  entityId: string,
  entityName: string,
  content: any
): Promise<void> {
  const keys = extractMediaKeys(content);
  const statements = [];

  // 1. Delete existing references for this entity
  statements.push(
    db.prepare('DELETE FROM media_references WHERE entity_type = ? AND entity_id = ?')
      .bind(entityType, entityId)
  );

  // 2. Insert new references
  for (const key of keys) {
    statements.push(
      db.prepare('INSERT INTO media_references (image_key, entity_type, entity_id, entity_name) VALUES (?, ?, ?, ?)')
        .bind(key, entityType, entityId, entityName)
    );
  }

  // Execute in batch transaction
  if (statements.length > 0) {
    try {
      await db.batch(statements);
      console.log(`[MediaRef] Updated references for ${entityType}:${entityId}. Found keys: ${keys.length}`);
    } catch (err) {
      console.error(`[MediaRef] Failed to update references for ${entityType}:${entityId}:`, err);
    }
  }
}
