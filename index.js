const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const { Upload } = require('@aws-sdk/lib-storage');
const stream = require('stream');

module.exports = {
    init(config) {
        const s3Client = new S3Client(config.s3Options);
        const S3BaseUrl = config.baseUrl ? config.baseUrl : `https://${config.s3Options.params.Bucket}.s3.${config.s3Options.region}.amazonaws.com`;

        const generateVariants = async (buffer, formats, sizes, uniqueSize=false) => {
            const variants = {};
            for (const format of formats) {
                for (const size of sizes) {
                    const key = uniqueSize ? size.name : `${size.name}_${format.name}`;
                    variants[key] = {
                        format: format.name,
                        size: size.name,
                        width: size.width,
                        options: format.options,
                    };
                }
            }

            try{
                let ops = Object.values(variants).map((variant) => sharp(buffer)
                    .resize(variant.width)
                    .toFormat(variant.format, variant.options || {})
                    .toBuffer());

                const processedBuffers = await Promise.all(ops);
                Object.values(variants).forEach((variant, index) => {
                    variant.buffer = processedBuffers[index];
                });
            }catch (e){
                strapi.log.error("Generation failed",e);
            }
            return variants;
        };

        const uploadToS3 = async (buffer, key, contentType) => {
            await s3Client.send(new PutObjectCommand({
                ...config.s3Options.params,
                Key: key,
                Body: buffer,
                ContentType: contentType,
            }));
            return `${S3BaseUrl}/${key}`;
        };

        const internalUpload = async (file) => {
            const {buffer} = file;
            const formats = config.formats || [{name: 'webp'}, {name: 'jpg', options: {quality: 90}}]; // Default formats
            const sizes = config.sizes || [{name: 'medium', width: 960}]; // Default sizes

            const urls = {};
            if (!file.hash.toLowerCase().includes("thumbnail_")) {
                // Generate image variants
                const variants = {
                    ...await generateVariants(buffer, formats, sizes),
                    ...await generateVariants(buffer, [{name: 'webp'}], [{name: 'thumbnail', width: 256}], true)
                };

                // Upload variants to S3
                for (const [key, {buffer: variantBuffer, format, size}] of Object.entries(variants)) {
                    const fileName = `${file.hash}_${size}.${format}`;
                    const fileKey = (config.rootPath ? `${config.rootPath}/` : "") + fileName;
                    const url = await uploadToS3(variantBuffer, fileKey, `image/${format}`);
                    urls[key] = {
                        "name": fileName,
                        "ext": `.${format}`,
                        "mime": `image/${format}`,
                        "url": url
                    };
                }

                // Upload original file
                const originalKey = (config.rootPath ? `${config.rootPath}/` : "") + `${file.hash}${file.ext}`;
                file.url = await uploadToS3(buffer, originalKey, file.mime);

                // Attach variants to file object
                file.formats = urls;
            }
        }

        return {
            async upload(file) {
                try{
                    await internalUpload(file);
                    strapi.log.info(`File incl. its variants uploaded successfully: ${file.url}`);
                } catch (error) {
                    strapi.log.error('Error uploading file(s): ', error);
                }
            },

            async delete(file) {
                try {
                    const keys = [file.url, ...Object.values(file.formats || {})]
                        .map((url) => {
                                if (typeof url === "string") {
                                    return url.replace(`${S3BaseUrl}/`, '')
                                }else if(typeof url === "object"){
                                    return [url.url,...Object.values(url.formats || {})].map(turl => turl?.replace(`${S3BaseUrl}/`, ''));
                                }else{
                                    return null;
                                }
                            }
                        )
                        .flat()
                        .filter((item) => item !== null);

                    const deletePromises = keys.map((key) =>
                        s3Client.send(new DeleteObjectCommand({ Bucket: config.s3Options.params.Bucket, Key: key }))
                    );
                    let responses = await Promise.all(deletePromises);
                    responses.forEach((response, index) => {
                        if(response.DeleteMarker){
                            strapi.log.info(`Deleted file ${keys[index]}: ` + response.DeleteMarker);
                        }else{
                            strapi.log.error(`Deleted file ${keys[index]}: ` + response.DeleteMarker);
                        }
                    });
                } catch (error) {
                    strapi.log.error('Error deleting S3 files:', error);
                }
            },
        };
    },
};
