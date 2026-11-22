import ExcelJS from 'exceljs';
import type { AttendanceRecord } from '../types';
import { EXCEL_FILENAME, TABLE_NAME, WORKSHEET_NAME } from '../services/firestoreAttendance';

const EXCEL_HEADERS = [
  'ID de registro',
  'Código del participante',
  'Nombres',
  'Apellidos',
  'Fecha',
  'Hora',
  'Jornada',
  'Estado de asistencia',
  'Fecha y hora de creación del registro',
] as const;

export async function exportRecordsToExcelFile(
  records: AttendanceRecord[],
  dateSlug?: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Mi Huella de Bienestar';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(WORKSHEET_NAME);

  const rows = records.map((r) => [
    r.id,
    r.codigo,
    r.nombres,
    r.apellidos,
    r.fecha,
    r.hora,
    r.jornada,
    r.estado,
    r.createdAt,
  ]);

  if (rows.length > 0) {
    worksheet.addTable({
      name: TABLE_NAME,
      ref: 'A1',
      headerRow: true,
      totalsRow: false,
      style: {
        theme: 'TableStyleMedium2',
        showRowStripes: true,
      },
      columns: EXCEL_HEADERS.map((name) => ({ name, filterButton: true })),
      rows,
    });
  } else {
    worksheet.addRow([...EXCEL_HEADERS]);
  }

  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  const widths = [20, 24, 24, 24, 14, 12, 42, 20, 28];
  widths.forEach((width, index) => {
    worksheet.getColumn(index + 1).width = width;
  });

  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF5B3FD9' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  });

  for (let i = 2; i <= rows.length + 1; i++) {
    const row = worksheet.getRow(i);
    row.height = 22;
    row.eachCell((cell) => {
      cell.font = { size: 10.5, name: 'Calibri', color: { argb: 'FF241B35' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE9E4F5' } },
      };
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const filename = dateSlug
    ? `ASISTENCIA_HUELLA_DE_BIENESTAR_${dateSlug.replace(/[^0-9-]/g, '') || 'FILTRADO'}.xlsx`
    : EXCEL_FILENAME;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
}
