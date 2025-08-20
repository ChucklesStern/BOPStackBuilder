// Simple test of PDF generation
const { generatePDF } = require('./server/services/pdfGenerator');

async function testPDF() {
  console.log('Starting PDF test...');
  
  const mockStackData = {
    stack: { 
      id: 'test-stack',
      title: 'Test Stack',
      createdAt: new Date()
    },
    parts: [{
      id: 'test-part',
      partType: 'ANNULAR',
      pressureValue: 5000,
      flangeSpec: {
        id: 'test-flange',
        flangeSizeRaw: '21"',
        ringNeeded: 'Yes',
        sizeOfBolts: '1 1/8"',
        boltCount: 16,
        wrenchNo: '1 3/4"',
        truckUnitPsi: 5000,
        pressureClassLabel: '5K'
      }
    }]
  };
  
  try {
    await generatePDF(mockStackData, '/tmp/test.pdf');
    console.log('PDF generation completed');
  } catch (error) {
    console.error('PDF generation failed:', error);
  }
}

testPDF();