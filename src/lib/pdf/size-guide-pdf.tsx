/* eslint-disable jsx-a11y/alt-text -- react-pdf Image is not a DOM <img>; alt is unsupported. */
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { PrintfulCatalogMeta, PrintfulSizeGuideTable } from "@/lib/types";

type PdfStyle = Parameters<typeof StyleSheet.create>[0][string];

const BRAND = {
  primary: "#a855f7",
  ink: "#1a1530",
  body: "#3f3a55",
  subtle: "#7a7290",
  divider: "#e8e4f0",
  rowAlt: "#faf8ff",
  headerRow: "#f3eeff",
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 56,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    color: BRAND.body,
    fontSize: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: BRAND.primary,
    borderBottomStyle: "solid",
  },
  logo: { width: 44, height: 44 },
  headerRight: { alignItems: "flex-end", maxWidth: "70%" },
  brandName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    color: BRAND.primary,
    letterSpacing: 0.5,
  },
  productName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    color: BRAND.ink,
    marginTop: 4,
    textAlign: "right",
  },
  byCreator: { fontSize: 10, color: BRAND.subtle, marginTop: 2 },
  pageTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 18,
    color: BRAND.ink,
    marginTop: 18,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 10,
    color: BRAND.subtle,
    marginBottom: 14,
    lineHeight: 1.4,
  },
  groupCard: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: BRAND.divider,
    borderStyle: "solid",
    borderRadius: 6,
    padding: 14,
  },
  groupHeader: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: BRAND.ink,
    marginBottom: 8,
    textTransform: "capitalize",
  },
  twoColRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  diagramWrap: {
    width: 160,
    borderWidth: 1,
    borderColor: BRAND.divider,
    borderStyle: "solid",
    borderRadius: 4,
    padding: 6,
    backgroundColor: "#fff",
  },
  diagramImg: { width: "100%", height: 200, objectFit: "contain" },
  diagramCaption: {
    marginTop: 6,
    fontSize: 8,
    color: BRAND.subtle,
    lineHeight: 1.4,
  },
  tableCol: { flex: 1, minWidth: 0 },
  table: {
    borderWidth: 1,
    borderColor: BRAND.divider,
    borderStyle: "solid",
    borderRadius: 4,
    overflow: "hidden",
  },
  tHead: {
    flexDirection: "row",
    backgroundColor: BRAND.headerRow,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.divider,
    borderBottomStyle: "solid",
  },
  tRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BRAND.divider,
    borderBottomStyle: "solid",
  },
  tRowAlt: { backgroundColor: BRAND.rowAlt },
  tRowLast: { borderBottomWidth: 0 },
  thMeasurement: {
    flex: 2,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
    color: BRAND.subtle,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  thSize: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: BRAND.subtle,
    textAlign: "center",
  },
  tdMeasurement: {
    flex: 2,
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: BRAND.ink,
  },
  tdValue: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontSize: 9,
    color: BRAND.body,
    textAlign: "center",
  },
  helpText: {
    marginTop: 8,
    fontSize: 9,
    color: BRAND.body,
    lineHeight: 1.5,
  },
  introText: {
    fontSize: 9,
    color: BRAND.body,
    lineHeight: 1.5,
    marginBottom: 8,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: BRAND.divider,
    borderTopStyle: "solid",
  },
  footerText: { fontSize: 7, color: BRAND.subtle, lineHeight: 1.4 },
  footerLink: { fontSize: 7, color: BRAND.primary, fontFamily: "Helvetica-Bold" },
  empty: {
    fontSize: 10,
    color: BRAND.subtle,
    fontStyle: "italic",
    paddingVertical: 8,
  },
});

interface SizeGuideGroup {
  title: string;
  diagramBytes: Buffer | null;
  diagramFormat: "png" | "jpg" | null;
  introPlain: string;
  measurementHelpPlain: string;
  sizeColumns: string[];
  rows: { dimension: string; valuesBySize: Record<string, string> }[];
}

/**
 * Merges Printful size guides for the same `guideType` across units (inches + cm).
 * Each cell becomes `inches" (X cm)` when both units are present.
 */
export function buildSizeGuideGroups(meta: PrintfulCatalogMeta): SizeGuideGroup[] {
  const byType = new Map<string, PrintfulSizeGuideTable[]>();
  for (const g of meta.sizeGuides) {
    const list = byType.get(g.guideType) ?? [];
    list.push(g);
    byType.set(g.guideType, list);
  }

  const groups: SizeGuideGroup[] = [];
  for (const [guideType, tables] of byType) {
    const inchesTbl = tables.find((t) => /inch/i.test(t.unit));
    const cmTbl = tables.find((t) => /cm|centimet/i.test(t.unit));
    const fallbackTbl = tables[0];

    const primary = inchesTbl ?? fallbackTbl;
    const secondary = cmTbl && cmTbl !== primary ? cmTbl : null;

    const sizesFromMeta = meta.availableSizes.length > 0 ? meta.availableSizes : null;
    const sizesFromRows = Array.from(
      new Set(primary.rows.flatMap((r) => Object.keys(r.valuesBySize))),
    ).sort();
    const sizeColumns = sizesFromMeta
      ? sizesFromMeta.filter((s) => sizesFromRows.includes(s))
      : sizesFromRows;
    const finalSizeColumns = sizeColumns.length > 0 ? sizeColumns : sizesFromRows;

    const dimensions = primary.rows.map((r) => r.dimension);
    const rows = dimensions.map((dim) => {
      const pRow = primary.rows.find((r) => r.dimension === dim);
      const sRow = secondary?.rows.find((r) => r.dimension === dim);
      const valuesBySize: Record<string, string> = {};
      for (const sz of finalSizeColumns) {
        const inchVal = pRow?.valuesBySize[sz];
        const cmVal = sRow?.valuesBySize[sz];
        if (inchVal && cmVal) {
          valuesBySize[sz] = `${formatInches(inchVal, primary.unit)} (${cmVal} cm)`;
        } else if (inchVal) {
          valuesBySize[sz] = formatInches(inchVal, primary.unit);
        } else if (cmVal) {
          valuesBySize[sz] = `${cmVal} cm`;
        } else {
          valuesBySize[sz] = "—";
        }
      }
      return { dimension: dim, valuesBySize };
    });

    groups.push({
      title: guideType.replace(/_/g, " "),
      diagramBytes: null,
      diagramFormat: null,
      introPlain: primary.introPlain,
      measurementHelpPlain: primary.measurementHelpPlain,
      sizeColumns: finalSizeColumns,
      rows,
    });
  }

  return groups;
}

function formatInches(raw: string, unit: string): string {
  const trimmed = raw.trim();
  if (/^\d+(\.\d+)?(–\d+(\.\d+)?)?$/.test(trimmed) && /inch/i.test(unit)) {
    return `${trimmed}"`;
  }
  return trimmed;
}

/** First diagram across guides — Printful uses the same diagram per type/unit pair. */
export function pickDiagramUrl(meta: PrintfulCatalogMeta): string | null {
  for (const g of meta.sizeGuides) {
    if (g.imageUrl) return g.imageUrl;
  }
  return null;
}

interface SizeGuideDocumentProps {
  productName: string;
  productSlug: string;
  productUrl: string;
  creatorName: string | null;
  groups: SizeGuideGroup[];
  logoBuffer: Buffer | null;
  logoFormat: "png" | "jpg" | null;
  generatedAt: Date;
}

export function SizeGuideDocument({
  productName,
  creatorName,
  productUrl,
  groups,
  logoBuffer,
  logoFormat,
  generatedAt,
}: SizeGuideDocumentProps) {
  const dateStr = generatedAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Document
      title={`${productName} — Size guide`}
      author="Gamerhood"
      creator="Gamerhood"
      subject={`Size guide for ${productName}`}
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header} fixed>
          {logoBuffer && logoFormat ? (
            <Image style={styles.logo} src={{ data: logoBuffer, format: logoFormat }} />
          ) : (
            <Text style={styles.brandName}>GAMERHOOD</Text>
          )}
          <View style={styles.headerRight}>
            <Text style={styles.brandName}>GAMERHOOD.GG</Text>
            <Text style={styles.productName}>{productName}</Text>
            {creatorName ? (
              <Text style={styles.byCreator}>by {creatorName}</Text>
            ) : null}
          </View>
        </View>

        <Text style={styles.pageTitle}>Size guide</Text>
        <Text style={styles.pageSubtitle}>
          Measurements come from the supplier&apos;s product specs. Find your fit by comparing
          measurements to a garment you already own.
        </Text>

        {groups.length === 0 ? (
          <Text style={styles.empty}>
            No size measurements are available for this product.
          </Text>
        ) : (
          groups.map((group, gi) => (
            <View key={`${group.title}-${gi}`} style={styles.groupCard} wrap={false}>
              <Text style={styles.groupHeader}>{group.title}</Text>
              {group.introPlain.length > 0 ? (
                <Text style={styles.introText}>{group.introPlain}</Text>
              ) : null}

              <View style={styles.twoColRow}>
                {group.diagramBytes && group.diagramFormat ? (
                  <View style={styles.diagramWrap}>
                    <Image
                      style={styles.diagramImg}
                      src={{
                        data: group.diagramBytes,
                        format: group.diagramFormat,
                      }}
                    />
                    {group.measurementHelpPlain.length > 0 ? (
                      <Text style={styles.diagramCaption}>
                        {group.measurementHelpPlain}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.tableCol}>
                  {group.sizeColumns.length > 0 && group.rows.length > 0 ? (
                    <SizeTable
                      sizeColumns={group.sizeColumns}
                      rows={group.rows}
                    />
                  ) : (
                    <Text style={styles.empty}>No measurements available.</Text>
                  )}
                  {!group.diagramBytes && group.measurementHelpPlain.length > 0 ? (
                    <Text style={styles.helpText}>{group.measurementHelpPlain}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          ))
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Measurements may vary by up to 2&quot; / 5 cm.{"\n"}
            Generated {dateStr} by{" "}
            <Text style={styles.footerLink}>gamerhood.gg</Text>
          </Text>
          <Text style={styles.footerText}>{productUrl}</Text>
        </View>
      </Page>
    </Document>
  );
}

function SizeTable({
  sizeColumns,
  rows,
}: {
  sizeColumns: string[];
  rows: { dimension: string; valuesBySize: Record<string, string> }[];
}) {
  return (
    <View style={styles.table}>
      <View style={styles.tHead}>
        <Text style={styles.thMeasurement}>Measurement</Text>
        {sizeColumns.map((sz) => (
          <Text key={sz} style={styles.thSize}>
            {sz}
          </Text>
        ))}
      </View>
      {rows.map((row, ri) => {
        const isLast = ri === rows.length - 1;
        const rowStyle: PdfStyle[] = [styles.tRow];
        if (ri % 2 === 1) rowStyle.push(styles.tRowAlt);
        if (isLast) rowStyle.push(styles.tRowLast);
        return (
          <View key={`${row.dimension}-${ri}`} style={rowStyle} wrap={false}>
            <Text style={styles.tdMeasurement}>{row.dimension}</Text>
            {sizeColumns.map((sz) => (
              <Text key={sz} style={styles.tdValue}>
                {row.valuesBySize[sz] ?? "—"}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}

export type { SizeGuideGroup };
