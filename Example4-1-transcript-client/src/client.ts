import { remoteDelete, remoteGet, remotePost } from './remoteService';
import { Course, StudentID, Transcript } from './transcriptManager';

/*
 POST /transcripts
 -- adds a new student to the database, returns an ID for this student.
 -- Requires a post parameter 'name'.
 -- Multiple students may have the same name.
 */
export async function addStudent(studentName: string): Promise<{ studentID: number }> {
  return remotePost('/transcripts', { name: studentName });
}

/*
 GET  /transcripts/:ID           -
- returns name transcript for student with given ID.  Fails if no such student
*/
export async function getTranscript(studentID: number): Promise<Transcript> {
  return remoteGet(`/transcripts/${studentID}`);
}

/*
GET  /studentids?name=string     -- returns list of IDs for student with the given name
*/
export async function getStudentIDs(studentName: string): Promise<StudentID[]> {
  return remoteGet(`studentids?name=${studentName}`);
}

/*
DELETE /transcripts/:ID
-- deletes transcript for student with the given ID, fails if no such student
*/
export async function deleteStudent(studentID: StudentID): Promise<void> {
  return remoteDelete(`/transcripts/${studentID}`);
}


/* POST /transcripts/:studentID/:course   -- /transcripts
-- adds an entry in this student's transcript with given name and course.
-- Requires a post parameter 'grade'. Fails if there is already an entry for this course in the student's transcript
*/
export async function addGrade(studentID: StudentID, course: Course, grade: number)
  : Promise<{ grade: number }> {
  return remotePost(`/transcripts/${studentID}/${course}`, { grade });
}

// GET /transcripts/:studentID/:course
// returns the student's grade in the specified course as a
// TS object.
// Fails if student or course is missing.
export async function getGrade(studentID: StudentID, course: Course)
  : Promise<Record<string, void>> {
  return remoteGet(`/transcripts/${studentID}/${course}`);
}

// * GET /transcripts     -- returns list of all transcripts
export async function getAllTranscripts(): Promise<Transcript[]> {
  return remoteGet('/transcripts');
}
