package com.keshi.kotoba.folder;

import com.keshi.kotoba.auth.AppUserPrincipal;
import com.keshi.kotoba.web.ApiError;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** 阅读（文章）和应试（真题）里的集。kind 只在列表和新建时要，改名、删除按 id 就够。 */
@RestController
@RequestMapping("/api/folders")
public class FolderController {

    private final FolderService folderService;

    public FolderController(FolderService folderService) {
        this.folderService = folderService;
    }

    @GetMapping
    public FolderListing list(@AuthenticationPrincipal AppUserPrincipal user,
                              @RequestParam Folder.Kind kind) {
        return folderService.list(user.id(), kind);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FolderListing.Item create(@AuthenticationPrincipal AppUserPrincipal user,
                                     @Valid @RequestBody CreateFolderRequest request) {
        Folder folder = folderService.create(user.id(), request.kind(), request.name());
        return new FolderListing.Item(folder.getId(), folder.getName(), 0, folder.getCreatedAt());
    }

    @PatchMapping("/{id}")
    public FolderListing.Item rename(@AuthenticationPrincipal AppUserPrincipal user,
                                     @PathVariable Long id,
                                     @Valid @RequestBody FolderRequest request) {
        Folder folder = folderService.rename(user.id(), id, request.name());
        return new FolderListing.Item(folder.getId(), folder.getName(), 0, folder.getCreatedAt());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AppUserPrincipal user, @PathVariable Long id) {
        folderService.delete(user.id(), id);
    }

    @ExceptionHandler(FolderNameTakenException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    ApiError onNameTaken(FolderNameTakenException e) {
        return new ApiError(e.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    ApiError onIllegalArgument(IllegalArgumentException e) {
        return new ApiError(e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    ApiError onInvalidRequest(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .findFirst()
                .orElse("请求参数不合法");
        return new ApiError(message);
    }
}
