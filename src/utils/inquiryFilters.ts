export interface InquiryFilters {
  whereString: string;
  params: string[];
}

function escapeLikePattern(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_');
}

export function buildInquiryFilters(
  searchParams: URLSearchParams,
): InquiryFilters {
  const whereClauses: string[] = [];
  const params: string[] = [];
  const status = searchParams.get('status');
  const search = searchParams.get('search')?.trim();

  if (status) {
    whereClauses.push('status = ?');
    params.push(status);
  }

  if (search) {
    const pattern = `%${escapeLikePattern(search)}%`;
    whereClauses.push(
      "(name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR company LIKE ? ESCAPE '\\')",
    );
    params.push(pattern, pattern, pattern);
  }

  return {
    whereString:
      whereClauses.length > 0
        ? `WHERE ${whereClauses.join(' AND ')}`
        : '',
    params,
  };
}
