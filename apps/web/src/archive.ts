export type ArchiveLocale = "en" | "pt-br";

export interface PublicArchiveTag {
  slug: string;
  label: string;
}

/**
 * Deliberately narrow public projection. Implementations must construct this
 * directly from allow-listed database fields, never from an authenticated DTO.
 */
export interface PublicArchiveItem {
  slug: string;
  title: string;
  summary: string | null;
  selectedText: string | null;
  sourceDomain: string;
  outboundUrl: string;
  publishedAt: Date;
  updatedAt: Date;
  tags: readonly PublicArchiveTag[];
}

export interface PublicArchiveListQuery {
  locale: ArchiveLocale;
  query?: string;
  tag?: string;
  page: number;
  pageSize: 20;
}

export interface PublicArchiveList {
  items: readonly PublicArchiveItem[];
  total: number;
  tags: readonly PublicArchiveTag[];
}

export interface PublicSitemapItem {
  slug: string;
  updatedAt: Date;
}

export interface PublicArchiveReader {
  list(query: PublicArchiveListQuery): Promise<PublicArchiveList>;
  getBySlug(slug: string, locale: ArchiveLocale): Promise<PublicArchiveItem | null>;
  listForSitemap(): Promise<readonly PublicSitemapItem[]>;
}
