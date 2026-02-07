// ─── Input Validation Middleware ──────────────
// Uses Joi for strict request validation

const Joi = require("joi");
const config = require("../config");

const supportedLanguages = Object.keys(config.LANGUAGES);

// ─── Schema: POST /api/execute ───
const executeSchema = Joi.object({
  language: Joi.string()
    .valid(...supportedLanguages)
    .required()
    .messages({
      "any.only": `Language must be one of: ${supportedLanguages.join(", ")}`,
      "any.required": "Language is required",
    }),
  code: Joi.string()
    .min(1)
    .max(config.MAX_CODE_SIZE)
    .required()
    .messages({
      "string.max": `Code exceeds maximum size of ${config.MAX_CODE_SIZE} bytes`,
      "string.empty": "Code cannot be empty",
      "any.required": "Code is required",
    }),
  input: Joi.string().max(config.MAX_CODE_SIZE).allow("").default(""),
  timeLimit: Joi.number()
    .integer()
    .min(1)
    .max(config.MAX_TIME_LIMIT)
    .default(config.DEFAULT_TIME_LIMIT)
    .messages({
      "number.max": `Time limit cannot exceed ${config.MAX_TIME_LIMIT} seconds`,
    }),
  memoryLimit: Joi.number()
    .integer()
    .min(16)
    .max(config.MAX_MEMORY_LIMIT)
    .default(config.DEFAULT_MEMORY_LIMIT)
    .messages({
      "number.max": `Memory limit cannot exceed ${config.MAX_MEMORY_LIMIT} MB`,
    }),
});

// ─── Schema: Test case ───
const testCaseSchema = Joi.object({
  input: Joi.string().max(config.MAX_CODE_SIZE).allow("").required(),
  expectedOutput: Joi.string().max(config.MAX_CODE_SIZE).required(),
});

// ─── Schema: POST /api/judge ───
const judgeSchema = Joi.object({
  language: Joi.string()
    .valid(...supportedLanguages)
    .required()
    .messages({
      "any.only": `Language must be one of: ${supportedLanguages.join(", ")}`,
    }),
  code: Joi.string()
    .min(1)
    .max(config.MAX_CODE_SIZE)
    .required()
    .messages({
      "string.max": `Code exceeds maximum size of ${config.MAX_CODE_SIZE} bytes`,
    }),
  testCases: Joi.array()
    .items(testCaseSchema)
    .min(1)
    .max(50)
    .required()
    .messages({
      "array.min": "At least 1 test case is required",
      "array.max": "Maximum 50 test cases allowed",
    }),
  timeLimit: Joi.number()
    .integer()
    .min(1)
    .max(config.MAX_TIME_LIMIT)
    .default(config.DEFAULT_TIME_LIMIT),
  memoryLimit: Joi.number()
    .integer()
    .min(16)
    .max(config.MAX_MEMORY_LIMIT)
    .default(config.DEFAULT_MEMORY_LIMIT),
});

// ─── Middleware: Validate execute request ───
function validateExecution(req, res, next) {
  const { error, value } = executeSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      success: false,
      error: "Validation Error",
      details: error.details.map((d) => d.message),
    });
  }
  req.body = value;
  next();
}

// ─── Middleware: Validate judge request ───
function validateJudge(req, res, next) {
  const { error, value } = judgeSchema.validate(req.body, {
    abortEarly: false,
  });
  if (error) {
    return res.status(400).json({
      success: false,
      error: "Validation Error",
      details: error.details.map((d) => d.message),
    });
  }
  req.body = value;
  next();
}

module.exports = { validateExecution, validateJudge };
