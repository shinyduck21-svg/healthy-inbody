function getPhotoExt(mimeType) {
    const allowed = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif'
    };
    return allowed[mimeType] || null;
}

function getSupabaseStorageConfig() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'meal-photos';
    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Supabase Storage 환경변수(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)를 확인해주세요.');
    }
    return {
        supabaseUrl: supabaseUrl.replace(/\/$/, ''),
        serviceRoleKey,
        bucket
    };
}

async function uploadPhotoToStorage(objectPath, buffer, mimeType) {
    const { supabaseUrl, serviceRoleKey, bucket } = getSupabaseStorageConfig();
    const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${encodedPath}`;
    const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': mimeType,
            'x-upsert': 'false'
        },
        body: buffer
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`Supabase Storage 업로드 실패(${response.status}): ${detail}`);
    }

    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

function getStorageObjectPathFromPublicUrl(photoUrl) {
    if (!photoUrl) return null;
    const { supabaseUrl, bucket } = getSupabaseStorageConfig();
    const publicPrefix = `${supabaseUrl}/storage/v1/object/public/${bucket}/`;
    if (!photoUrl.startsWith(publicPrefix)) return null;
    return photoUrl.slice(publicPrefix.length).split('/').map(decodeURIComponent).join('/');
}

async function deletePhotoFromStorage(photoUrl) {
    const objectPath = getStorageObjectPathFromPublicUrl(photoUrl);
    if (!objectPath) return;

    const { supabaseUrl, serviceRoleKey, bucket } = getSupabaseStorageConfig();
    const response = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
        method: 'DELETE',
        headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prefixes: [objectPath] })
    });

    if (!response.ok) {
        const detail = await response.text();
        console.warn(`Supabase Storage 기존 사진 삭제 실패(${response.status}): ${detail}`);
    }
}

module.exports = {
    getPhotoExt,
    getSupabaseStorageConfig,
    uploadPhotoToStorage,
    getStorageObjectPathFromPublicUrl,
    deletePhotoFromStorage
};
