#import "RNCWebViewDecisionManager.h"

/**
 * Exodus: Thread-safe singleton that manages navigation decision handlers.
 *
 * Security improvements over upstream:
 * - Uses NSInteger (64-bit) instead of int to prevent overflow
 * - Adds collision checking to skip identifiers still in use
 * - All public methods use @synchronized for thread safety
 * - Explicitly copies blocks to heap to prevent use-after-free
 * - Provides cancelDecisionForLockIdentifier: for cleanup on WebView dealloc
 */
@implementation RNCWebViewDecisionManager

@synthesize nextLockIdentifier;
@synthesize decisionHandlers;

+ (id)getInstance {
    static RNCWebViewDecisionManager *lockManager = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        lockManager = [[self alloc] init];
    });
    return lockManager;
}

- (NSInteger)setDecisionHandler:(DecisionBlock)decisionHandler {
    @synchronized (self) {
        NSInteger lockIdentifier = self.nextLockIdentifier++;

        while ([self.decisionHandlers objectForKey:@(lockIdentifier)] != nil) {
            lockIdentifier = self.nextLockIdentifier++;
        }

        [self.decisionHandlers setObject:[decisionHandler copy] forKey:@(lockIdentifier)];

        // Exodus: Deny-by-default timeout
        // If JS doesn't respond within 500ms, deny the navigation for security.
        // setResult:forLockIdentifier: removes the handler, so this is a no-op
        // if JS responded in time.
        NSInteger capturedIdentifier = lockIdentifier;
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(500 * NSEC_PER_MSEC)), dispatch_get_main_queue(), ^{
            @synchronized (self) {
                DecisionBlock pendingHandler = [self.decisionHandlers objectForKey:@(capturedIdentifier)];
                if (pendingHandler != nil) {
                    RCTLogWarn(@"Navigation decision timeout for lock %ld, denying by default", (long)capturedIdentifier);
                    pendingHandler(NO);
                    [self.decisionHandlers removeObjectForKey:@(capturedIdentifier)];
                }
            }
        });

        return lockIdentifier;
    }
}

- (void)setResult:(BOOL)shouldStart forLockIdentifier:(NSInteger)lockIdentifier {
    @synchronized (self) {
        DecisionBlock handler = [self.decisionHandlers objectForKey:@(lockIdentifier)];
        if (handler == nil) {
            RCTLogWarn(@"Lock not found for identifier: %ld", (long)lockIdentifier);
            return;
        }
        handler(shouldStart);
        [self.decisionHandlers removeObjectForKey:@(lockIdentifier)];
    }
}


- (void)cancelDecisionForLockIdentifier:(NSInteger)lockIdentifier {
    @synchronized (self) {
        [self.decisionHandlers removeObjectForKey:@(lockIdentifier)];
    }
}

- (id)init {
    if (self = [super init]) {
        self.nextLockIdentifier = 1;
        self.decisionHandlers = [[NSMutableDictionary alloc] init];
    }
    return self;
}

- (void)dealloc {}

@end
