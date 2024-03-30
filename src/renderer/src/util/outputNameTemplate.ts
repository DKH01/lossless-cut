export function generateOutSegFileNames({
  segments,
  template: desiredTemplate,
  formatTimecode,
  isCustomFormatSelected,
  fileFormat,
  filePath,
  outputDir,
  safeOutputFileName,
  maxLabelLength,
  outputFileNameMinZeroPadding,
}: {
  segments: SegmentToExport[];
  template: string;
  formatTimecode: FormatTimecode;
  isCustomFormatSelected: boolean;
  fileFormat: string;
  filePath: string;
  outputDir: string;
  safeOutputFileName: boolean;
  maxLabelLength: number;
  outputFileNameMinZeroPadding: number;
}): { outSegFileNames: string[]; outSegProblems: { error?: string | undefined; sameAsInputFileNameWarning?: boolean | undefined } } {
  function generate({ template, forceSafeOutputFileName }: { template: string; forceSafeOutputFileName: boolean }) {
    const epochMs = Date.now();

    return segments.map((segment, i) => {
      const { start, end, name = '' } = segment;
      const segNum = formatSegNum(i, segments.length, outputFileNameMinZeroPadding);

      // Fields that did not come from the source file's name must be sanitized, because they may contain characters that are not supported by the target operating/file system
      // however we disable this when the user has chosen to (safeOutputFileName === false)
      const filenamifyOrNot = (fileName: string) =>
        (safeOutputFileName || forceSafeOutputFileName ? filenamify(fileName) : fileName).slice(0, Math.max(0, maxLabelLength));

      function getSegSuffix() {
        if (name) return `-${filenamifyOrNot(name)}`;
        // https://github.com/mifi/lossless-cut/issues/583
        if (segments.length > 1) return `-seg${segNum}`;
        return '';
      }

      const { name: inputFileNameWithoutExt } = parsePath(filePath);

      let segFileName = interpolateSegmentFileName({
        template,
        epochMs,
        segNum,
        inputFileNameWithoutExt,
        segSuffix: getSegSuffix(),
        ext: getOutFileExtension({ isCustomFormatSelected, outFormat: fileFormat, filePath }),
        segLabel: filenamifyOrNot(name),
        cutFrom: formatTimecode({ seconds: start, fileNameFriendly: true }),
        cutTo: formatTimecode({ seconds: end, fileNameFriendly: true }),
        tags: Object.fromEntries(Object.entries(getSegmentTags(segment)).map(([tag, value]) => [tag, filenamifyOrNot(value)])),
      });

      // Check if the output file name contains "_Trimmed_{SEG_NUM}" and adjust it accordingly if there's only one segment
      if (segments.length === 1 && segFileName.includes('_Trimmed_{SEG_NUM}')) {
        segFileName = segFileName.replace(`_Trimmed_${segNum}`, '');
      }

      // Now split the path by its separator, so we can check the actual file name (last path seg)
      const pathSegs = segFileName.split(pathSep);
      if (pathSegs.length === 0) return '';
      const [lastSeg] = pathSegs.slice(-1);
      const rest = pathSegs.slice(0, -1);

      return [
        ...rest,
        // If sanitation is enabled, make sure filename (last seg of the path) is not too long
        safeOutputFileName ? lastSeg!.slice(0, 200) : lastSeg,
      ].join(pathSep);
    });
  }

  let outSegFileNames = generate({ template: desiredTemplate, forceSafeOutputFileName: false });

  const outSegProblems = getOutSegProblems({ fileNames: outSegFileNames, filePath, outputDir, safeOutputFileName });
  if (outSegProblems.error != null) {
    outSegFileNames = generate({ template: defaultOutSegTemplate, forceSafeOutputFileName: true });
  }

  return { outSegFileNames, outSegProblems };
}

export type GenerateOutSegFileNames = (a: { segments?: SegmentToExport[]; template: string }) => ReturnType<typeof generateOutSegFileNames>;
