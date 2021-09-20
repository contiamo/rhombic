import { CustomPatternMatcherFunc } from "chevrotain";

const functionNames = [
  "COLLECT",
  "LISTAGG",
  "COUNT",
  "FUSION",
  "APPROX_COUNT_DISTINCT",
  "AVG",
  "SUM",
  "MAX",
  "MIN",
  "ANY_VALUE",
  "BIT_AND",
  "BIT_OR",
  "CONCAT",
  "STDDEV_POP",
  "STDDEV_SAMP",
  "STDDEV",
  "VAR_POP",
  "VAR_SAMP",
  "COVAR_POP",
  "COVAR_SAMP",
  "REGR_COUNT",
  "REGR_SXX",
  "REGR_SYY",
  "RANK",
  "DENSE_RANK",
  "ROW_NUMBER",
  "FIRST_VALUE",
  "LAST_VALUE",
  "LEAD",
  "LAG",
  "NTH_VALUE",
  "NTILE",
  "GROUPING",
  "GROUP_ID",
  "GROUPING_ID",
  "HOP",
  "SESSION",
  "TUMBLE",
  "HOP_END",
  "HOP_START",
  "SESSION_END",
  "SESSION_START",
  "TUMBLE_END",
  "TUMBLE_START",
  "ST_AsText",
  "ST_AsWKT",
  "ST_GeomFromText",
  "ST_LineFromText",
  "ST_MLineFromText",
  "ST_MPointFromText",
  "ST_MPolyFromText",
  "ST_PointFromText",
  "ST_PolyFromText",
  "ST_MakeLine",
  "ST_MakePoint",
  "ST_Point",
  "ST_Boundary",
  "ST_Distance",
  "ST_GeometryType",
  "ST_GeometryTypeCode",
  "ST_Envelope",
  "ST_X",
  "ST_Y",
  "ST_Is3D",
  "ST_Z",
  "ST_Contains",
  "ST_ContainsProperly",
  "ST_Crosses",
  "ST_Disjoint",
  "ST_DWithin",
  "ST_EnvelopesIntersect",
  "ST_Equals",
  "ST_Intersects",
  "ST_Overlaps",
  "ST_Touches",
  "ST_Within",
  "ST_Buffer",
  "ST_Union",
  "ST_SetSRID",
  "ST_Transform",
  "JSON_EXISTS",
  "JSON_VALUE",
  "JSON_QUERY",
  "JSON_OBJECT",
  "JSON_OBJECTAGG",
  "JSON_ARRAY",
  "JSON_ARRAYAGG",
  "DECODE",
  "DIFFERENCE",
  "GREATEST",
  "JSON_TYPE",
  "JSON_DEPTH",
  "JSON_PRETTY",
  "JSON_LENGTH",
  "JSON_KEYS",
  "JSON_REMOVE",
  "JSON_STORAGE_SIZE",
  "LEAST",
  "LEFT",
  "LTRIM",
  "NVL",
  "REPEAT",
  "REVERSE",
  "RIGHT",
  "RTRIM",
  "SOUNDEX",
  "SPACE",
  "SUBSTR",
  "TRANSLATE"
];

/**
 * Custom matcher for sql function name.
 *
 * @param text
 */
export const matchFunctionName: CustomPatternMatcherFunc = (text: string, offset: number) => {
  const chunk = text.slice(offset).split("(")[0] || "";

  return functionNames.includes(chunk.toUpperCase()) ? ([chunk] as RegExpExecArray) : null;
};
