declare module 'react-native-html-to-pdf' {
  interface ConvertOptions {
    html: string;
    fileName: string;
    directory?: string;
    width?: number;
    height?: number;
    bgColor?: string;
    padding?: number;
  }

  interface ConvertResult {
    filePath: string;
  }

  const RNHTMLtoPDF: {
    convert(options: ConvertOptions): Promise<ConvertResult>;
  };

  export default RNHTMLtoPDF;
}
