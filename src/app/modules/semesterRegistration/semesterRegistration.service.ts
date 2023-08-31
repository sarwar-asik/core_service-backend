import {
  Prisma,
  SemesterRegistration,
  SemesterRegistrationStatus,
} from '@prisma/client';
import httpStatus from 'http-status';
import ApiError from '../../../errors/ApiError';
import { paginationHelpers } from '../../../helpers/paginationHelper';
import { IGenericResponse } from '../../../interfaces/common';
import { IPaginationOptions } from '../../../interfaces/pagination';
import prisma from '../../../shared/prisma';
import { semesterRegistrationRelationalFields, semesterRegistrationRelationalFieldsMapper, semesterRegistrationSearchableFields } from './semesterRegistration.constant';

const insertDB = async (
  data: SemesterRegistration
): Promise<SemesterRegistration> => {
  const isAnySemesterRegistrationUpcoming =
    await prisma.semesterRegistration.findFirst({
      where: {
        OR: [
          {
            status: SemesterRegistrationStatus.UPCOMING,
          },
          {
            status: SemesterRegistrationStatus.ONGOING,
          },
        ],
      },
    });
  if (isAnySemesterRegistrationUpcoming) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `There is already an ${isAnySemesterRegistrationUpcoming?.status} registration `
    );
  }
  const result = await prisma.semesterRegistration.create({
    data,
  });

  return result;
};



type ISemesterRegistrationFilterRequest = {
  searchTerm?: string | undefined;
    academicSemesterId?: string | undefined;
};


const getAllFromDB = async (
  filters: ISemesterRegistrationFilterRequest,
  options: IPaginationOptions
): Promise<IGenericResponse<SemesterRegistration[]>> => {
  const { limit, page, skip } = paginationHelpers.calculatePagination(options);
  const { searchTerm, ...filterData } = filters;

  const andConditions = [];

  if (searchTerm) {
      andConditions.push({
          OR: semesterRegistrationSearchableFields.map((field) => ({
              [field]: {
                  contains: searchTerm,
                  mode: 'insensitive'
              }
          }))
      });
  }

  if (Object.keys(filterData).length > 0) {
      andConditions.push({
          AND: Object.keys(filterData).map((key) => {
              if (semesterRegistrationRelationalFields.includes(key)) {
                  return {
                      [semesterRegistrationRelationalFieldsMapper[key]]: {
                          id: (filterData as any)[key]
                      }
                  };
              } else {
                  return {
                      [key]: {
                          equals: (filterData as any)[key]
                      }
                  };
              }
          })
      });
  }

  const whereConditions: Prisma.SemesterRegistrationWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

  const result = await prisma.semesterRegistration.findMany({
      include: {
          academicSemester: true
      },
      where: whereConditions,
      skip,
      take: limit,
      orderBy:
          options.sortBy && options.sortOrder
              ? { [options.sortBy]: options.sortOrder }
              : {
                  createdAt: 'desc'
              }
  });
  const total = await prisma.semesterRegistration.count({
      where: whereConditions
  });

  return {
      meta: {
          total,
          page,
          limit
      },
      data: result
  };
};

const getByIdFromDB = async (id: string): Promise<SemesterRegistration | null> => {
  const result = await prisma.semesterRegistration.findUnique({
      where: {
          id
      },
      include: {
          academicSemester: true
      }
  });
  return result;
};




const updateOneToDB = async(id:string,payload:Partial<SemesterRegistration>):Promise<SemesterRegistration>=>{


  const isExist =await prisma.semesterRegistration.findUnique({
    where:{
      id
    }
  })

  if(!isExist){
    throw new ApiError(httpStatus.BAD_REQUEST,"Data not found")
  }

  if(payload?.status && isExist?.status === SemesterRegistrationStatus.UPCOMING && payload.status !== SemesterRegistrationStatus.ONGOING){
    throw new ApiError(httpStatus.BAD_REQUEST,"Can only move from UPCOMING to ONGOING")
  }

  if(payload?.status && isExist?.status === SemesterRegistrationStatus.ONGOING && payload.status !== SemesterRegistrationStatus.ENDED){
    throw new ApiError(httpStatus.BAD_REQUEST,"Can only move from ONGOING to ENDED")
  }
 

  const result = await prisma.semesterRegistration.update({
    where: {
        id
    },
    data: payload,
    include: {
        academicSemester: true
    }
})
  
return result;
}


export const SemesterRegistrationService = { insertDB,getAllFromDB,getByIdFromDB,updateOneToDB };