import axios from 'axios';
import { promises as fsPromises } from 'fs';
import * as client from './client';
import { CourseGrade, Transcript } from './transcriptManager';
type ImportTranscript = {
  studentName: string;
  grades: CourseGrade[];
};

// Write your sample/testing code for the client in this file, or call any of the methods in this file to see them run
// Run this file with `npm run client`

/* This method should:
    1. create a student record for each student in gradesToImport
    2. File the grades for each of those students as specified in gradesToImport
    3. After posting the grades, it should fetch the transcripts for each student and return an array of transcripts. 
*/
export async function importGrades(gradesToImport: ImportTranscript[]): Promise<Transcript[]> {
  const exportTranscripts: Transcript[] = [];
  while (gradesToImport.length > 0) {
    console.log('Creating a student');
    const transcript : ImportTranscript = gradesToImport.pop();
    const { studentID } = await client.addStudent(transcript.studentName);
    console.log(transcript.grades.forEach(cg => {
      client.addGrade(studentID, cg.course, cg.grade);
    }));
    exportTranscripts.push(await client.getTranscript(studentID));
  }

  //Here is some example code that makes the API calls that you will need (addStudent, addGrade, and getTranscript)
  // console.log('Creating a student');
  // const { studentID } = await client.addStudent('test student');
  // await client.addGrade(studentID, 'demo course', 100);
  // ret.push(await client.getTranscript(studentID));
  // return ret;
}

importGrades([
  {
    studentName: 'Avery',
    grades: [
      { course: 'Software Engineering', grade: 100 },
      { course: 'Chemistry', grade: 70 },
    ],
  },
  {
    studentName: 'Ripley',
    grades: [
      { course: 'Underwater Basket Weaving', grade: 100 },
      { course: 'Kayaking', grade: 90 },
    ],
  },
]).then(transcripts => {
  console.log('Import grades completed, and returned:');
  console.log(JSON.stringify(transcripts, null, 2));
});

//Some other examples that call the wrapper client
async function script1() {
  try {
    console.log('starting script1()');
    const p1 = await client.getTranscript(2);
    console.log('script1 says: getTranscript(2) says:', p1);
    const blakeIDs = await client.getStudentIDs('blake');
    console.log('script1 says: students named blake:', blakeIDs);
    try {
      await client.addGrade(blakeIDs[0], 'cs101', 85);
    } catch {
      console.log("script1 says: blake's grade already there, continuing");
    }
    console.log('script1 says', await client.getGrade(blakeIDs[0], 'cs101'));
    console.log('script1 succeeded');
  } catch {
    console.log('script1 failed');
  }
}

async function getTranscriptsByName(studentName: string) {
  try {
    console.log(`starting getTranscriptsByName(${studentName})`);
    const ids = await client.getStudentIDs(studentName);
    // put out all the requests in parallel, not sequentially
    // requests becomes an array of promises
    const requests: Promise<Transcript>[] = ids.map(id => client.getTranscript(id));
    const transcripts = await Promise.all(requests);
    console.log(`getTranscriptsByName says: ${studentName}'s transcripts:`, transcripts);
    console.log('getTranscriptsByName succeeded');
  } catch {
    console.log('getTranscriptsByName failed');
  }
}

//These are the examples that appear in the slides
function runClientPromises() {
  console.log('Making a requests');
  const studentIDs = [1, 2, 3, 4];
  const promisesForTranscripts = studentIDs.map(studentID =>
    axios
      .get(`https://rest-example.covey.town/transcripts/${studentID}`)
      .then(response =>
        fsPromises.writeFile(
          `transcript-${response.data.student.studentID}.json`,
          JSON.stringify(response.data),
        ),
      ),
  );
  return Promise.all(promisesForTranscripts)
    .then(results => {
      const statsPromises = studentIDs.map(studentID =>
        fsPromises.stat(`transcript-${studentID}.json`),
      );
      return Promise.all(statsPromises).then(stats => {
        const totalSize = stats.reduce((runningTotal, val) => runningTotal + val.size, 0);
        console.log(`Finished calculating size: ${totalSize}`);
      });
    })
    .then(() => {
      console.log('Done');
    });
  console.log('Requests sent!');
}

function runClientPromisesErrorHandlers() {
  console.log('Making a requests');
  const studentIDs = [1, 2, 3, 4];
  const promisesForTranscripts = studentIDs.map(studentID =>
    axios
      .get(`https://rest-example.covey.town/transcripts/${studentID}`)
      .then(response =>
        fsPromises.writeFile(
          `transcript-${response.data.student.studentID}.json`,
          JSON.stringify(response.data),
        ),
      ),
  );
  return Promise.all(promisesForTranscripts)
    .then(results => {
      const statsPromises = studentIDs.map(studentID =>
        fsPromises.stat(`transcript-${studentID}.json`),
      );
      return Promise.all(statsPromises).then(stats => {
        const totalSize = stats.reduce((runningTotal, val) => runningTotal + val.size, 0);
        console.log(`Finished calculating size: ${totalSize}`);
      });
    })
    .then(() => {
      console.log('Done');
    });
  console.log('Requests sent!');
}

async function runClientAsync() {
  console.log('Making a requests');
  const studentIDs = [1, 2, 3, 4];
  const promisesForTranscripts = studentIDs.map(async studentID => {
    const response = await axios.get(`https://rest-example.covey.town/transcripts/${studentID}`);
    await fsPromises.writeFile(
      `transcript-${response.data.student.studentID}.json`,
      JSON.stringify(response.data),
    );
  });
  console.log('Requests sent!');
  await Promise.all(promisesForTranscripts);
  const stats = await Promise.all(
    studentIDs.map(studentID => fsPromises.stat(`transcript-${studentID}.json`)),
  );
  const totalSize = stats.reduce((runningTotal, val) => runningTotal + val.size, 0);
  console.log(`Finished calculating size: ${totalSize}`);
  console.log('Done');
}

async function runClientAsyncSerially() {
  console.log('Making a requests');
  const studentIDs = [1, 2, 3, 4];
  for (const studentID of studentIDs) {
    const response = await axios.get(`https://rest-example.covey.town/transcripts/${studentID}`);
    await fsPromises.writeFile(
      `transcript-${response.data.student.studentID}.json`,
      JSON.stringify(response.data),
    );
  }
  let totalSize = 0;
  for (const studentID of studentIDs) {
    const stats = await fsPromises.stat(`transcript-${studentID}.json`);
    totalSize += stats.size;
  }
  console.log(`Finished calculating size: ${totalSize}`);
}
