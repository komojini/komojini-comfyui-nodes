

class PythonNode:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "python_code": ("STRING", {"default": "", "multiline": True})
            },
            "optional": {
                
            },
        }