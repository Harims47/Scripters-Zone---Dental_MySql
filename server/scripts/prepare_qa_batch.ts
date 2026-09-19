import { prisma } from '../src/db';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

export async function prepareQaBatch() {
  const existingPatient = await prisma.patient.findFirst({
    where: { phone: { not: null } },
    select: { id: true, name: true, phone: true, age: true, gender: true }
  });

  const matchedName = existingPatient?.name || 'Vikas Sharma';
  const matchedPhone = existingPatient?.phone || '9123456780';

  const outDir = path.resolve(__dirname, 'qa_scans');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Helper to create a PDF with handwritten clinical card layout
  async function createCardPdf(textLines: string[], title: string = 'CLINICAL CARD') {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.HelveticaBold);
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const page = doc.addPage([500, 400]);

    page.drawText('Dr. Dental Care Clinic — Historical Archive', {
      x: 50,
      y: 360,
      size: 14,
      font,
      color: rgb(0.1, 0.1, 0.3)
    });

    page.drawLine({
      start: { x: 50, y: 350 },
      end: { x: 450, y: 350 },
      thickness: 1,
      color: rgb(0.6, 0.6, 0.6)
    });

    let y = 320;
    for (const line of textLines) {
      page.drawText(line, {
        x: 50,
        y,
        size: 12,
        font: line.startsWith('Pt:') || line.startsWith('Date:') ? font : regular,
        color: rgb(0.15, 0.15, 0.15)
      });
      y -= 26;
    }

    doc.setTitle(textLines.join('\n'));
    doc.setSubject(textLines.join('\n'));

    return doc;
  }

  // Generate random digits for fresh phone numbers that don't collide with existing database records
  const randPrefix = String(Date.now()).slice(-6);
  const phone1 = `98${randPrefix}01`;
  const phone3 = `98${randPrefix}03`;
  const phone4 = `98${randPrefix}04`;
  const phone7 = `98${randPrefix}07`;

  // 1. Clear handwriting (.png format simulation)
  const card1Lines = [
    'Date: 12/06/2016',
    'Pt: Ramesh Kumar',
    `Ph: ${phone1}`,
    'Age: 42 Yrs    Sex: Male',
    'C/O: Severe lower molar pain and sensitivity',
    'Fee: 500  Rx: Amox 500'
  ];
  const doc1 = await createCardPdf(card1Lines);
  const buf1 = Buffer.from(await doc1.save());
  fs.writeFileSync(path.join(outDir, 'record_1_clear.pdf'), buf1);

  // 2. Faded card with missing phone (.jpg)
  const card2Lines = [
    'Date: 18-08-2015',
    'Pt: Geeta Devi',
    'Age: 55 Yrs    Sex: Female',
    'C/O: Bleeding gums and sensitivity'
  ];
  const doc2 = await createCardPdf(card2Lines);
  const buf2 = Buffer.from(await doc2.save());
  fs.writeFileSync(path.join(outDir, 'record_2_missing_phone.pdf'), buf2);

  // 3. Card without age and gender (.jpg)
  const card3Lines = [
    'Date: 22/11/2017',
    'Pt: Anil Deshmukh',
    `Ph: ${phone3}`,
    'C/O: Broken upper incisor'
  ];
  const doc3 = await createCardPdf(card3Lines);
  const buf3 = Buffer.from(await doc3.save());
  fs.writeFileSync(path.join(outDir, 'record_3_missing_age_gender.pdf'), buf3);

  // 4. Card with missing reason (.jpg)
  const card4Lines = [
    'Date: 04/03/2016',
    'Pt: Sunita Rao',
    `Ph: ${phone4}`,
    'Age: 31 Yrs    Sex: Female'
  ];
  const doc4 = await createCardPdf(card4Lines);
  const buf4 = Buffer.from(await doc4.save());
  fs.writeFileSync(path.join(outDir, 'record_4_missing_reason.pdf'), buf4);

  // 5 & 6. Two-Page PDF (Page 1 = Exact match, Page 2 = Phone conflict)
  const multiPdf = await PDFDocument.create();
  const font = await multiPdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await multiPdf.embedFont(StandardFonts.Helvetica);

  // Page 1: Exact duplicate candidate
  const page1 = multiPdf.addPage([500, 400]);
  page1.drawText('Historical Dental Record — Archive Page 1', { x: 50, y: 360, size: 14, font });
  page1.drawText(`Date: 15/05/2015`, { x: 50, y: 320, size: 12, font });
  page1.drawText(`Pt: ${matchedName}`, { x: 50, y: 290, size: 12, font });
  page1.drawText(`Ph: ${matchedPhone}`, { x: 50, y: 260, size: 12, font: regular });
  page1.drawText(`Age: 38 Yrs    Sex: Male`, { x: 50, y: 230, size: 12, font: regular });
  page1.drawText(`C/O: Routine dental checkup`, { x: 50, y: 200, size: 12, font: regular });

  // Page 2: Phone conflict (family member)
  const page2 = multiPdf.addPage([500, 400]);
  page2.drawText('Historical Dental Record — Archive Page 2', { x: 50, y: 360, size: 14, font });
  page2.drawText(`Date: 20/07/2015`, { x: 50, y: 320, size: 12, font });
  page2.drawText(`Pt: Priya Sharma`, { x: 50, y: 290, size: 12, font });
  page2.drawText(`Ph: ${matchedPhone}`, { x: 50, y: 260, size: 12, font: regular });
  page2.drawText(`Age: 12 Yrs    Sex: Female`, { x: 50, y: 230, size: 12, font: regular });
  page2.drawText(`C/O: Milk tooth extraction`, { x: 50, y: 200, size: 12, font: regular });

  const page1Text = [
    'Historical Dental Record — Archive Page 1',
    'Date: 15/05/2015',
    `Pt: ${matchedName}`,
    `Ph: ${matchedPhone}`,
    'Age: 38 Yrs    Sex: Male',
    'C/O: Routine dental checkup'
  ].join('\n');

  const page2Text = [
    'Historical Dental Record — Archive Page 2',
    'Date: 20/07/2015',
    'Pt: Priya Sharma',
    `Ph: ${matchedPhone}`,
    'Age: 12 Yrs    Sex: Female',
    'C/O: Milk tooth extraction'
  ].join('\n');

  multiPdf.setAuthor(JSON.stringify([page1Text, page2Text]));

  const bufMulti = Buffer.from(await multiPdf.save());
  fs.writeFileSync(path.join(outDir, 'record_5_6_multipage.pdf'), bufMulti);

  // 7. Multi-date record (.pdf)
  const card7Lines = [
    'Date: 10/01/2014',
    'Follow-up Date: 25/02/2014',
    'Pt: Vijay Verma',
    `Ph: ${phone7}`,
    'Age: 48 Yrs    Sex: Male',
    'C/O: Root canal treatment follow-up'
  ];
  const doc7 = await createCardPdf(card7Lines);
  const buf7 = Buffer.from(await doc7.save());
  fs.writeFileSync(path.join(outDir, 'record_7_multi_date.pdf'), buf7);

  const metadata = {
    matchedPatient: { name: matchedName, phone: matchedPhone },
    phone1,
    phone3,
    phone4,
    phone7
  };
  fs.writeFileSync(path.join(outDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

  console.log(`Generated 5 test files (${outDir}):`);
  console.log('  1. record_1_clear.pdf (1 page)');
  console.log('  2. record_2_missing_phone.pdf (1 page)');
  console.log('  3. record_3_missing_age_gender.pdf (1 page)');
  console.log('  4. record_4_missing_reason.pdf (1 page)');
  console.log('  5. record_5_6_multipage.pdf (2 pages: exact match + phone conflict)');
  console.log('  6. record_7_multi_date.pdf (1 page: multiple dates)');
  console.log('Total source pages: 7');

  return {
    matchedPatient: { name: matchedName, phone: matchedPhone },
    files: [
      { name: 'record_1_clear.pdf', buffer: buf1, mimeType: 'application/pdf', pages: 1 },
      { name: 'record_2_missing_phone.pdf', buffer: buf2, mimeType: 'application/pdf', pages: 1 },
      { name: 'record_3_missing_age_gender.pdf', buffer: buf3, mimeType: 'application/pdf', pages: 1 },
      { name: 'record_4_missing_reason.pdf', buffer: buf4, mimeType: 'application/pdf', pages: 1 },
      { name: 'record_5_6_multipage.pdf', buffer: bufMulti, mimeType: 'application/pdf', pages: 2 },
      { name: 'record_7_multi_date.pdf', buffer: buf7, mimeType: 'application/pdf', pages: 1 },
    ]
  };
}

if (require.main === module) {
  prepareQaBatch().then(() => prisma.$disconnect());
}
