import { prisma } from './src/db';

async function main() {
  const yokesh = await prisma.patient.findFirst({ where: { name: 'Yokesh' } });
  const sujitha = await prisma.patient.findFirst({ where: { name: 'Sujitha' } });

  console.log('PATIENTS:', { yokeshId: yokesh?.id, sujithaId: sujitha?.id });

  if (yokesh) {
    const yVisits = await prisma.visit.findMany({ where: { patientId: yokesh.id } });
    const yAppts = await prisma.appointment.findMany({ where: { patientId: yokesh.id } });
    console.log('YOKESH VISITS:', yVisits);
    console.log('YOKESH APPTS:', yAppts);
  }

  if (sujitha) {
    const sVisits = await prisma.visit.findMany({ where: { patientId: sujitha.id } });
    const sAppts = await prisma.appointment.findMany({ where: { patientId: sujitha.id } });
    console.log('SUJITHA VISITS:', sVisits);
    console.log('SUJITHA APPTS:', sAppts);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
