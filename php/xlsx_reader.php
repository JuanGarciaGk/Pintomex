<?php
class XlsxReader {
    private $zipPath;

    public function __construct(string $path) {
        $this->zipPath = $path;
    }

    public function getRows(): array {
        $zip = new ZipArchive();
        if ($zip->open($this->zipPath) !== true) {
            throw new RuntimeException('No se pudo abrir el archivo XLSX');
        }

        $sharedStrings = $this->parseSharedStrings($zip);
        $rows = $this->parseSheet($zip, $sharedStrings);

        $zip->close();
        return $rows;
    }

    private function parseSharedStrings(ZipArchive $zip): array {
        $strings = [];
        $xml = $zip->getFromName('xl/sharedStrings.xml');
        if ($xml === false) return $strings;

        $dom = new DOMDocument();
        libxml_use_internal_errors(true);
        $dom->loadXML($xml);
        libxml_clear_errors();

        foreach ($dom->getElementsByTagName('si') as $si) {
            $t = $si->getElementsByTagName('t');
            $val = '';
            foreach ($t as $node) {
                $val .= $node->nodeValue;
            }
            $strings[] = $val;
        }

        return $strings;
    }

    private function parseSheet(ZipArchive $zip, array $sharedStrings): array {
        $xml = $zip->getFromName('xl/worksheets/sheet1.xml');
        if ($xml === false) {
            throw new RuntimeException('No se encontró la hoja de cálculo en el archivo');
        }

        $dom = new DOMDocument();
        libxml_use_internal_errors(true);
        $dom->loadXML($xml);
        libxml_clear_errors();

        $rows = [];
        foreach ($dom->getElementsByTagName('row') as $rowNode) {
            $rowIndex = (int)$rowNode->getAttribute('r') - 1;
            $rowData = [];

            foreach ($rowNode->getElementsByTagName('c') as $cell) {
                $ref = $cell->getAttribute('r');
                $colIndex = $this->colToIndex(preg_replace('/[0-9]/', '', $ref));
                $type = $cell->getAttribute('t');
                $vNode = $cell->getElementsByTagName('v')->item(0);
                $val = $vNode ? $vNode->nodeValue : '';

                if ($type === 's') {
                    $val = $sharedStrings[(int)$val] ?? '';
                } elseif ($type === 'inlineStr') {
                    $is = $cell->getElementsByTagName('is')->item(0);
                    $t  = $is ? $is->getElementsByTagName('t')->item(0) : null;
                    $val = $t ? $t->nodeValue : '';
                }

                $rowData[$colIndex] = $val;
            }

            if (!empty($rowData)) {
                $maxCol = max(array_keys($rowData));
                $filled = [];
                for ($i = 0; $i <= $maxCol; $i++) {
                    $filled[$i] = $rowData[$i] ?? '';
                }
                $rows[$rowIndex] = $filled;
            }
        }

        ksort($rows);
        return array_values($rows);
    }

    private function colToIndex(string $col): int {
        $col = strtoupper($col);
        $index = 0;
        $len = strlen($col);
        for ($i = 0; $i < $len; $i++) {
            $index = $index * 26 + (ord($col[$i]) - ord('A') + 1);
        }
        return $index - 1;
    }
}