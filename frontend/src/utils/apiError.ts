export function formatApiError(detail: unknown, fallback = 'Something went wrong'): string {
  if (typeof detail === 'string' && detail.trim()) {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => formatApiError(item, ''))
      .filter((message) => message.trim().length > 0);

    return messages.length > 0 ? messages.join(', ') : fallback;
  }

  if (detail && typeof detail === 'object') {
    if ('msg' in detail && typeof detail.msg === 'string' && detail.msg.trim()) {
      return detail.msg;
    }

    if ('detail' in detail) {
      return formatApiError(detail.detail, fallback);
    }

    try {
      const serialized = JSON.stringify(detail);
      return serialized === '{}' ? fallback : serialized;
    } catch {
      return fallback;
    }
  }

  return fallback;
}

export function formatDisplayValue(value: unknown, fallback = '-'): string {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => formatDisplayValue(item, '')).filter(Boolean);
    return items.length > 0 ? items.join(', ') : fallback;
  }

  if (typeof value === 'object') {
    if ('msg' in value && typeof value.msg === 'string' && value.msg.trim()) {
      return value.msg;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return fallback;
    }
  }

  return fallback;
}
