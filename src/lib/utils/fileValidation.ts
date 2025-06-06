export const ALLOWED_IMAGE_TYPES = [
	'image/jpeg',
	'image/jpg',
	'image/png',
	'image/webp',
	'image/gif'
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export interface FileValidationResult {
	isValid: boolean;
	error?: string;
}

export function validateImageFile(file: File): FileValidationResult {
	if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
		return {
			isValid: false,
			error: `Invalid file type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`
		};
	}

	if (file.size > MAX_FILE_SIZE_BYTES) {
		return {
			isValid: false,
			error: `File too large. Maximum size: ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`
		};
	}

	return { isValid: true };
}

export function sanitizeFilename(filename: string): string {
	return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
}

export function validateMultipleFiles(files: File[]): {
	validFiles: File[];
	invalidFiles: Array<{ file: File; error: string }>;
} {
	const validFiles: File[] = [];
	const invalidFiles: Array<{ file: File; error: string }> = [];

	for (const file of files) {
		const validation = validateImageFile(file);
		if (validation.isValid) {
			validFiles.push(file);
		} else {
			invalidFiles.push({ file, error: validation.error! });
		}
	}

	return { validFiles, invalidFiles };
}
