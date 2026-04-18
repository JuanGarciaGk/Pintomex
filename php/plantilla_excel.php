<?php
require_once 'config.php';

function generarXlsx(array $filas): string {
    $tmpFile = tempnam(sys_get_temp_dir(), 'xlsx_');

    $zip = new ZipArchive();
    $zip->open($tmpFile, ZipArchive::OVERWRITE);

    $zip->addFromString('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>');

    $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>');

    $zip->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>');

    $zip->addFromString('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Productos" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>');

    $zip->addFromString('xl/styles.xml', '<?xml version="1.0" encoding="UTF-8"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
</styleSheet>');

    $strings = [];
    $stringIndex = [];
    $sheetRows = '';

    foreach ($filas as $rowNum => $row) {
        $rowNum += 1;
        $sheetRows .= "<row r=\"{$rowNum}\">";
        foreach ($row as $colNum => $val) {
            $colLetter = columnLetter($colNum);
            $ref = "{$colLetter}{$rowNum}";
            $strVal = (string)$val;

            if (is_numeric($strVal) && $strVal !== '') {
                $sheetRows .= "<c r=\"{$ref}\"><v>" . htmlspecialchars($strVal, ENT_XML1) . "</v></c>";
            } else {
                if (!isset($stringIndex[$strVal])) {
                    $stringIndex[$strVal] = count($strings);
                    $strings[] = $strVal;
                }
                $si = $stringIndex[$strVal];
                $sheetRows .= "<c r=\"{$ref}\" t=\"s\"><v>{$si}</v></c>";
            }
        }
        $sheetRows .= '</row>';
    }

    $sheetXml = '<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>' . $sheetRows . '</sheetData>
</worksheet>';
    $zip->addFromString('xl/worksheets/sheet1.xml', $sheetXml);

    $ssItems = '';
    foreach ($strings as $s) {
        $ssItems .= '<si><t xml:space="preserve">' . htmlspecialchars($s, ENT_XML1, 'UTF-8') . '</t></si>';
    }
    $ssXml = '<?xml version="1.0" encoding="UTF-8"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="' . count($strings) . '" uniqueCount="' . count($strings) . '">' . $ssItems . '</sst>';
    $zip->addFromString('xl/sharedStrings.xml', $ssXml);

    $zip->close();

    $content = file_get_contents($tmpFile);
    @unlink($tmpFile);
    return $content;
}

function columnLetter(int $index): string {
    $letter = '';
    $index += 1;
    while ($index > 0) {
        $mod = ($index - 1) % 26;
        $letter = chr(65 + $mod) . $letter;
        $index = (int)(($index - $mod) / 26);
    }
    return $letter;
}

$filas = [
    ['codigo_barras', 'nombre', 'descripcion', 'categoria', 'precio', 'stock_minimo', 'stock_actual'],
    ['7501234567901', 'Ejemplo Producto', 'Descripción del producto', 'Acrílicas', '150.00', '5', '10'],
];

$xlsx = generarXlsx($filas);

header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment; filename="plantilla_productos.xlsx"');
header('Content-Length: ' . strlen($xlsx));
header('Cache-Control: no-cache, no-store, must-revalidate');
echo $xlsx;
exit;