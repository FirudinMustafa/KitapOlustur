import { Document, Page, Text, View, StyleSheet, Svg, Circle, Path } from "@react-pdf/renderer";
import { PALETTE, type Variant } from "./BookDocument";

export type CourseUnitSummary = {
  number: number;
  title: string;
  topic: string;
  keyTerms: string;
  objectives: string;
  level: string;
};

const styles = StyleSheet.create({
  page: { padding: 44, fontSize: 10, fontFamily: "Times-Roman", color: "#1f2937" },
  headerBand: { paddingVertical: 22, paddingHorizontal: 26, borderRadius: 10, marginBottom: 22, position: "relative", overflow: "hidden" },
  headerDecoration: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  headerKicker: { fontFamily: "Helvetica-Bold", fontSize: 10, color: "#ffffff", opacity: 0.85, letterSpacing: 2, marginBottom: 6 },
  headerTitle: { fontFamily: "Helvetica-Bold", fontSize: 22, color: "#ffffff" },

  tableHeaderRow: { flexDirection: "row", borderRadius: 6, paddingVertical: 7, paddingHorizontal: 8, marginBottom: 4 },
  tableHeaderCell: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#ffffff", letterSpacing: 0.5 },

  row: { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 8, borderRadius: 6, marginBottom: 5, alignItems: "flex-start" },

  colUnit: { width: "9%", alignItems: "center" },
  colTitle: { width: "26%", paddingRight: 6 },
  colKeyTerms: { width: "22%", paddingRight: 6 },
  colObjectives: { width: "22%", paddingRight: 6 },
  colLevel: { width: "21%" },

  unitBadge: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  unitBadgeText: { fontFamily: "Helvetica-Bold", fontSize: 9.5, color: "#ffffff" },

  cellTitle: { fontFamily: "Helvetica-Bold", fontSize: 9.5, marginBottom: 2 },
  cellTopic: { fontSize: 8.5, fontFamily: "Times-Italic", color: "#4b5563", lineHeight: 1.3 },
  cellText: { fontSize: 8.5, lineHeight: 1.35 },

  footer: {
    position: "absolute",
    bottom: 22,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.75,
    borderTopColor: "#e5e7eb",
    paddingTop: 6,
    fontSize: 8,
    color: "#9ca3af",
    fontFamily: "Helvetica",
  },
});

export function ContentsPageContent({
  bookTitle,
  level,
  variant = "student_book",
  units,
}: {
  bookTitle: string;
  level: string;
  variant?: Variant;
  units: CourseUnitSummary[];
}) {
  const palette = PALETTE[variant];

  return (
    <Page size="A4" style={styles.page}>
      <View style={[styles.headerBand, { backgroundColor: palette.primaryDark }]}>
        <Svg viewBox="0 0 600 140" style={styles.headerDecoration}>
          <Circle cx="560" cy="10" r="80" fill="#ffffff" opacity={0.06} />
          <Circle cx="40" cy="130" r="60" fill={palette.accent} opacity={0.15} />
          <Path d="M0 100 L600 60 L600 140 L0 140 Z" fill="#ffffff" opacity={0.04} />
        </Svg>
        <Text style={styles.headerKicker}>{bookTitle.toUpperCase()} · LEVEL {level}</Text>
        <Text style={styles.headerTitle}>Contents</Text>
      </View>

      <View style={[styles.tableHeaderRow, { backgroundColor: palette.primary }]}>
        <Text style={[styles.tableHeaderCell, styles.colUnit]}>UNIT</Text>
        <Text style={[styles.tableHeaderCell, styles.colTitle]}>TITLE & TOPIC</Text>
        <Text style={[styles.tableHeaderCell, styles.colKeyTerms]}>KEY TERMS</Text>
        <Text style={[styles.tableHeaderCell, styles.colObjectives]}>OBJECTIVES</Text>
        <Text style={[styles.tableHeaderCell, styles.colLevel]}>LEVEL</Text>
      </View>

      {units.map((unit, i) => (
        <View
          key={unit.number}
          style={[styles.row, { backgroundColor: i % 2 === 0 ? palette.primaryLight : "#ffffff" }]}
          wrap={false}
        >
          <View style={styles.colUnit}>
            <View style={[styles.unitBadge, { backgroundColor: palette.primary }]}>
              <Text style={styles.unitBadgeText}>{unit.number}</Text>
            </View>
          </View>
          <View style={styles.colTitle}>
            <Text style={[styles.cellTitle, { color: palette.primaryDark }]}>{unit.title}</Text>
            <Text style={styles.cellTopic}>{unit.topic}</Text>
          </View>
          <Text style={[styles.cellText, styles.colKeyTerms]}>{unit.keyTerms}</Text>
          <Text style={[styles.cellText, styles.colObjectives]}>{unit.objectives}</Text>
          <Text style={[styles.cellText, styles.colLevel]}>{unit.level}</Text>
        </View>
      ))}

      <View style={styles.footer} fixed>
        <Text>{bookTitle} · Contents</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  );
}

export function ContentsDocument(props: {
  bookTitle: string;
  level: string;
  variant?: Variant;
  units: CourseUnitSummary[];
}) {
  return (
    <Document title={`${props.bookTitle} - Contents`}>
      <ContentsPageContent {...props} />
    </Document>
  );
}
